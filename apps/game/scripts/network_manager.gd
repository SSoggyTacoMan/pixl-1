extends Node
signal logged_in(display_name: String)
signal connected_to_server
signal disconnected_from_server
signal player_joined(user_id: String, display_name: String, pos: Vector2, direction: String, skin: String)
signal player_moved(user_id: String, pos: Vector2, direction: String)
signal player_left(user_id: String)
signal scene_init(your_user_id: String, your_pos: Vector2, other_players: Array, spawn_at_default: bool)
signal player_skin_changed(user_id: String, skin: String)
signal chat_message(user_id: String, display_name: String, text: String)
signal dm_received(from_name: String, to_name: String, text: String, outgoing: bool)
signal dm_error(reason: String)
signal emote_received(user_id: String, key: String)
signal blocks_updated(ids: Array)
signal npc_init(scene: String, npcs: Array)
signal lobby_list_received(lobbies: Array)
signal lobby_joined(lobby: Dictionary)
signal lobby_denied(reason: String)
signal village_invited(invite_id: int, from_name: String, lobby_name: String)
signal lobby_theme_changed(theme: String)
signal name_result(ok: bool, text: String)
signal login_failed(reason: String)

# The hosts live in packages/config/pixl.json and reach the export through
# res://pixl.json, so moving domains is one config edit plus `bun run
# config:sync` rather than a hunt through the scripts. These are vars, not
# consts, because a const has to be known at parse time and this reads the
# synced file at runtime. There is no dev/local override on purpose: the
# server only accepts the configured play origin.
var SERVER_HTTP_URL: String = PixlConfig.url("server", "https://server.pixl.hackclub.com")
var SERVER_WS_URL: String = PixlConfig.url("ws", "wss://server.pixl.hackclub.com/ws")

var session_token: String = ""
var user_id: String = ""
var display_name: String = ""
var _blocked: Dictionary = {}
var is_new_account: bool = false
var needs_legal_name: bool = false
var ban_message: String = ""
# Shown once on the login screen after the server forced a re-login (4401).
var login_notice: String = ""
var local_skin: String = "cvc:1"
var current_scene_name: String = "village"
var current_lobby_id: String = ""
var current_lobby_theme: String = ""
var _socket: WebSocketPeer = WebSocketPeer.new()
var _connected: bool = false
# True once the server has answered our first-message auth (it sends nothing
# before the session checks pass). Nothing else is sent until then.
var _authed: bool = false
var _auth_sent: bool = false
const WebLogin := preload("res://scripts/web_login.gd")
const TOKEN_SAVE_PATH = "user://session.dat"
var _http: HTTPRequest
var _pending_scene_change: String = ""
var _connect_deadline_msec: int = 0
const CONNECT_TIMEOUT_MSEC := 8000

func _is_socket_open() -> bool:
	return _authed and _socket.get_ready_state() == WebSocketPeer.STATE_OPEN

## Headers for an authenticated call to the game server. The session token only
## ever travels in the Authorization header, never in a URL.
func auth_headers(extra: Array = []) -> PackedStringArray:
	var headers := PackedStringArray()
	if session_token != "":
		headers.append("Authorization: Bearer " + session_token)
	for h in extra:
		headers.append(String(h))
	return headers

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS

	_http = HTTPRequest.new()
	add_child(_http)

	# A fresh return from Hack Club Auth carries a one-time code to exchange;
	# that exchange replaces whatever session was saved, so don't also connect
	# with the old one in the meantime.
	if OS.has_feature("web") and _check_web_login_callback():
		return

	_try_auto_login()

func _try_auto_login() -> void:
	var saved = _load_session()
	if saved.has("token") and saved["token"] != "":
		session_token = saved["token"]
		display_name = saved.get("display_name", "")
		_connect_to_server()
		emit_signal("logged_in", display_name)

func _save_session() -> void:
	var file = FileAccess.open(TOKEN_SAVE_PATH, FileAccess.WRITE)
	if file:
		var data = { "token": session_token, "display_name": display_name }
		file.store_string(JSON.stringify(data))
		file.close()

func _load_session() -> Dictionary:
	if not FileAccess.file_exists(TOKEN_SAVE_PATH):
		return {}
	var file = FileAccess.open(TOKEN_SAVE_PATH, FileAccess.READ)
	if not file:
		return {}
	var content = file.get_as_text()
	file.close()
	var parsed = JSON.parse_string(content)
	if typeof(parsed) != TYPE_DICTIONARY:
		return {}
	return parsed

func clear_session() -> void:
	session_token = ""
	display_name = ""
	user_id = ""
	needs_legal_name = false
	if FileAccess.file_exists(TOKEN_SAVE_PATH):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(TOKEN_SAVE_PATH))
	WebPages.sign_out()

func _process(_delta: float) -> void:
	if not _connected:
		return
	_socket.poll()
	var state = _socket.get_ready_state()
	if state == WebSocketPeer.STATE_OPEN:
		_connect_deadline_msec = 0
		if not _auth_sent:
			# The server closes with 4401 unless this is the first message.
			_auth_sent = true
			_socket.send_text(JSON.stringify({ "type": "auth", "token": session_token }))
		while _socket.get_available_packet_count() > 0:
			var pkt := _socket.get_packet()
			if _socket.was_string_packet():
				# The server only talks to us once the auth was accepted.
				_authed = true
				_handle_message(pkt.get_string_from_utf8())
		if _authed and _pending_scene_change != "":
			var sc := _pending_scene_change
			_pending_scene_change = ""
			_socket.send_text(JSON.stringify({ "type": "change_scene", "scene": sc }))
	elif state == WebSocketPeer.STATE_CONNECTING:
		# The handshake can hang indefinitely (never reaching OPEN or CLOSED)
		# on a flaky connection - without this, request_lobby_list() and
		# everything else keeps silently no-opping forever with no feedback.
		if _connect_deadline_msec != 0 and Time.get_ticks_msec() > _connect_deadline_msec:
			push_error("WebSocket handshake timed out, retrying")
			_connect_to_server()
	elif state == WebSocketPeer.STATE_CLOSED:
		var was_connected := _connected
		_connected = false
		_authed = false
		if was_connected:
			var code = _socket.get_close_code()
			if code == 4001:
				clear_session()
			elif code == 4401:
				# Missing, invalid, expired or revoked token: sign in again.
				clear_session()
				login_notice = "Your session expired. Please log in again."
				get_tree().change_scene_to_file("res://scenes/login.tscn")
			elif code == 4003:
				ban_message = _socket.get_close_reason()
				if ban_message == "":
					ban_message = "You are banned from Pixl."
				get_tree().change_scene_to_file("res://scenes/login.tscn")
		emit_signal("disconnected_from_server")

func start_login() -> void:
	if not OS.has_feature("web"):
		# The server only redirects back to the configured web origins, so
		# there is no way to finish a login in a native build.
		login_failed.emit("Logging in only works in the web version at " + PixlConfig.url("play", "https://play.pixl.hackclub.com"))
		return
	_start_login_web()

func _start_login_web() -> void:
	var nonce := WebLogin.begin()
	var redirect := WebLogin.return_url()
	if nonce == "" or redirect == "":
		login_failed.emit("Could not start a secure login. Try again.")
		return
	var target := SERVER_HTTP_URL + "/auth/hackclub?redirect=" + redirect.uri_encode() + "&state=" + nonce.uri_encode()
	JavaScriptBridge.eval("window.location.href = %s;" % JSON.stringify(target), true)

# Returns true when the page was loaded by a login redirect and a code
# exchange is now in flight.
func _check_web_login_callback() -> bool:
	var code := WebLogin.take_code()
	if code == "":
		return false
	_exchange_login_code(code)
	return true

func _exchange_login_code(code: String) -> void:
	var req := HTTPRequest.new()
	add_child(req)
	req.request_completed.connect(func(_result, status, _headers, data):
		req.queue_free()
		var json = JSON.parse_string(data.get_string_from_utf8()) if data.size() > 0 else null
		if status != 200 or typeof(json) != TYPE_DICTIONARY or String(json.get("token", "")) == "":
			push_error("Login code exchange failed (HTTP %d)" % status)
			login_failed.emit("Login failed. Please try again.")
			# Fall back to whatever session was saved before, if any.
			_try_auto_login()
			return
		session_token = String(json["token"])
		var user = json.get("user", {})
		if typeof(user) == TYPE_DICTIONARY:
			user_id = String(user.get("id", ""))
			display_name = String(user.get("displayName", ""))
		is_new_account = bool(json.get("isNew", false))
		needs_legal_name = bool(json.get("needsLegalName", false))
		_save_session()
		emit_signal("logged_in", display_name)
		_connect_to_server()
	)
	var err := req.request(
		SERVER_HTTP_URL + "/auth/exchange",
		PackedStringArray(["Content-Type: application/json"]),
		HTTPClient.METHOD_POST,
		JSON.stringify({ "code": code })
	)
	if err != OK:
		req.queue_free()
		push_error("Could not send login code exchange: %s" % err)
		login_failed.emit("Login failed. Please try again.")
		_try_auto_login()

# --- CONNECTION ---
func _connect_to_server() -> void:
	var state = _socket.get_ready_state()
	if state != WebSocketPeer.STATE_CLOSED:
		_socket.close()
		_connected = false

	_authed = false
	_auth_sent = false
	# No token in the URL: it goes in the first message once the socket opens.
	var err = _socket.connect_to_url(SERVER_WS_URL)
	if err != OK:
		push_error("WebSocket connection failed: %s" % err)
		return
	_connected = true
	_connect_deadline_msec = Time.get_ticks_msec() + CONNECT_TIMEOUT_MSEC

func _handle_message(raw: String) -> void:
	var json = JSON.parse_string(raw)
	if json == null:
		return
	match json.get("type"):
		"init":
			var room := String(json.get("scene", ""))
			if room.begins_with("lobby:"):
				current_lobby_id = room.substr(6)
			elif room != "":
				current_lobby_id = ""
			user_id = json["you"]["userId"]
			display_name = json["you"]["displayName"]
			local_skin = String(json["you"].get("skin", local_skin))
			var my_pos = Vector2(json["you"]["posX"], json["you"]["posY"])

			var spawn_at_default = json.get("spawnAtDefault", false)
			emit_signal("scene_init", user_id, my_pos, json.get("players", []), spawn_at_default)
			emit_signal("connected_to_server")
		"player_joined":
			emit_signal(
				"player_joined",
				json["userId"],
				json["displayName"],
				Vector2(json["posX"], json["posY"]),
				json.get("direction", "bottom"),
				String(json.get("skin", "cvc:1"))
			)
		"player_moved":
			emit_signal(
				"player_moved",
				json["userId"],
				Vector2(json["posX"], json["posY"]),
				json.get("direction", "bottom")
			)
		"player_left":
			emit_signal("player_left", json["userId"])
		"player_skin":
			var uid = json["userId"]
			var sk = String(json.get("skin", "cvc:1"))
			if uid == user_id:
				local_skin = sk
			emit_signal("player_skin_changed", uid, sk)
		"chat":
			emit_signal("chat_message", json["userId"], String(json.get("displayName", "")), String(json.get("text", "")))
		"dm":
			emit_signal(
				"dm_received",
				String(json.get("fromName", "")),
				String(json.get("toName", "")),
				String(json.get("text", "")),
				String(json.get("fromId", "")) == user_id
			)
		"dm_error":
			emit_signal("dm_error", String(json.get("reason", "")))
		"emote":
			emit_signal("emote_received", json["userId"], String(json.get("key", "")))
		"blocks":
			_set_blocks(json.get("ids", []))
		"npc_init":
			var npcs: Array = []
			for n in json.get("npcs", []):
				npcs.append({
					"id": String(n.get("id", "")),
					"pos": Vector2(n.get("posX", 0), n.get("posY", 0))
				})
			emit_signal("npc_init", String(json.get("scene", "")), npcs)
		"lobby_list":
			emit_signal("lobby_list_received", json.get("lobbies", []))
		"lobby_joined":
			var lobby: Dictionary = json.get("lobby", {})
			current_lobby_id = String(lobby.get("id", ""))
			current_lobby_theme = String(lobby.get("theme", ""))
			emit_signal("lobby_joined", lobby)
		"lobby_denied":
			emit_signal("lobby_denied", String(json.get("reason", "")))
		"lobby_theme":
			current_lobby_theme = String(json.get("theme", ""))
			emit_signal("lobby_theme_changed", current_lobby_theme)
		"village_invited":
			emit_signal("village_invited", int(json.get("inviteId", 0)), String(json.get("fromName", "")), String(json.get("lobbyName", "")))
		"lobby_closed":
			current_lobby_id = ""
			current_lobby_theme = ""
			var cs = get_tree().current_scene
			if cs and cs.scene_file_path == "res://scenes/open_world.tscn":
				Loader.change_scene("res://scenes/village.tscn", "Lobby closed, heading home")

func send_emote(key: String) -> void:
	if not _is_socket_open():
		return
	_socket.send_text(JSON.stringify({"type": "emote", "key": key}))

func send_save_npcs(scene_name: String, npcs: Array) -> void:
	if not _is_socket_open() or npcs.is_empty():
		return
	_socket.send_text(JSON.stringify({"type": "save_npcs", "scene": scene_name, "npcs": npcs}))

func send_move(pos: Vector2, direction: String) -> void:
	if not _is_socket_open():
		return
	var msg = {
		"type": "move",
		"posX": pos.x,
		"posY": pos.y,
		"direction": direction
	}
	_socket.send_text(JSON.stringify(msg))

func send_set_skin(skin: String) -> void:
	local_skin = skin
	if not _is_socket_open():
		return
	_socket.send_text(JSON.stringify({
		"type": "set_skin",
		"skin": skin
	}))
	
func submit_display_name(name: String) -> void:
	var req := HTTPRequest.new()
	add_child(req)
	req.request_completed.connect(func(_result, code, _headers, data):
		req.queue_free()
		var json = JSON.parse_string(data.get_string_from_utf8()) if data.size() > 0 else null
		if code == 200 and typeof(json) == TYPE_DICTIONARY and json.get("ok", false):
			display_name = String(json["name"])
			if json.has("token"):
				session_token = String(json["token"])
			is_new_account = false
			_save_session()
			emit_signal("logged_in", display_name)
			emit_signal("name_result", true, display_name)
		else:
			var reason := "Couldn't save that name - try again."
			if typeof(json) == TYPE_DICTIONARY and json.has("reason"):
				reason = String(json["reason"])
			emit_signal("name_result", false, reason)
	)
	req.request(SERVER_HTTP_URL + "/api/profile/name", auth_headers(["Content-Type: application/json"]), HTTPClient.METHOD_POST, JSON.stringify({"name": name}))

# The socket can close mid-session (a network blip, or the server's 30s
# heartbeat terminating us while a browser tab is throttled) and nothing in a
# gameplay scene reconnects on its own, so every send_* below quietly no-ops
# until the player reloads. Sends the player can *see* fail report it instead.
# Returns true once a fresh connection is being opened.
func reconnect_if_dropped() -> bool:
	if _is_socket_open() or session_token == "":
		return false
	# Rejoin the room the player is standing in rather than whatever scene the
	# server last persisted; this is the same queue change_scene() uses.
	_pending_scene_change = current_scene_name
	_connect_to_server()
	return true

func send_chat(text: String) -> bool:
	if not _is_socket_open():
		reconnect_if_dropped()
		return false
	_socket.send_text(JSON.stringify({"type": "chat", "text": text}))
	return true

func send_dm(to_name: String, text: String) -> bool:
	if not _is_socket_open():
		reconnect_if_dropped()
		return false
	_socket.send_text(JSON.stringify({"type": "dm", "to": to_name, "text": text}))
	return true

func send_block(target_id: String) -> void:
	if not _is_socket_open() or target_id == "" or target_id == user_id:
		return
	_socket.send_text(JSON.stringify({"type": "block", "userId": target_id}))

func send_unblock(target_id: String) -> void:
	if not _is_socket_open() or target_id == "":
		return
	_socket.send_text(JSON.stringify({"type": "unblock", "userId": target_id}))

func is_blocked(target_id: String) -> bool:
	return _blocked.has(target_id)

func _set_blocks(ids: Array) -> void:
	_blocked.clear()
	for id in ids:
		_blocked[String(id)] = true
	emit_signal("blocks_updated", ids)

func send_join_friend(friend_user_id: String) -> void:
	if not _is_socket_open():
		return
	_socket.send_text(JSON.stringify({"type": "lobby_join_friend", "userId": friend_user_id}))

func send_accept_village_invite(invite_id: int) -> void:
	if not _is_socket_open():
		return
	_socket.send_text(JSON.stringify({"type": "lobby_accept_invite", "inviteId": invite_id}))

func send_scene_change(scene_name: String) -> void:
	var actual := scene_name
	if scene_name == "open_world" and current_lobby_id != "":
		actual = "lobby:" + current_lobby_id
	elif scene_name != "open_world":
		current_lobby_id = ""
		current_lobby_theme = ""
	current_scene_name = actual
	if _is_socket_open():
		_socket.send_text(JSON.stringify({ "type": "change_scene", "scene": actual }))
	else:
		_pending_scene_change = actual

func request_lobby_list() -> void:
	if not _is_socket_open():
		return
	_socket.send_text(JSON.stringify({"type": "lobby_list"}))

func send_lobby_create(is_public: bool, lobby_name: String = "") -> void:
	if not _is_socket_open():
		return
	_socket.send_text(JSON.stringify({"type": "lobby_create", "isPublic": is_public, "name": lobby_name}))

func send_lobby_join(id: String, password: String = "") -> void:
	if not _is_socket_open():
		return
	_socket.send_text(JSON.stringify({"type": "lobby_join", "id": id, "password": password}))

func send_lobby_quick_join() -> void:
	if not _is_socket_open():
		return
	_socket.send_text(JSON.stringify({"type": "lobby_quick_join"}))

func send_lobby_rename(id: String, new_name: String) -> void:
	if not _is_socket_open():
		return
	_socket.send_text(JSON.stringify({"type": "lobby_manage", "id": id, "action": "rename", "name": new_name}))

func send_lobby_visibility(id: String, is_public: bool) -> void:
	if not _is_socket_open():
		return
	_socket.send_text(JSON.stringify({"type": "lobby_manage", "id": id, "action": "visibility", "isPublic": is_public}))

func send_lobby_delete(id: String) -> void:
	if not _is_socket_open():
		return
	_socket.send_text(JSON.stringify({"type": "lobby_manage", "id": id, "action": "delete"}))

func send_lobby_theme(id: String, theme: String) -> void:
	if not _is_socket_open():
		return
	_socket.send_text(JSON.stringify({"type": "lobby_manage", "id": id, "action": "theme", "theme": theme}))

func send_buy_village_theme(id: String, theme: String) -> void:
	if not _is_socket_open():
		return
	_socket.send_text(JSON.stringify({"type": "lobby_manage", "id": id, "action": "buy_theme", "theme": theme}))

func is_connected_to_server() -> bool:
	return _connected

func logout() -> void:
	if _socket.get_ready_state() != WebSocketPeer.STATE_CLOSED:
		_socket.close()
	_connected = false
	_authed = false
	_revoke_session_on_server()
	clear_session()

# Fire-and-forget: the local session is dropped either way, this just makes
# sure the token is dead on the server too.
func _revoke_session_on_server() -> void:
	if session_token == "":
		return
	var req := HTTPRequest.new()
	add_child(req)
	req.request_completed.connect(func(_result, _status, _headers, _data): req.queue_free())
	if req.request(SERVER_HTTP_URL + "/auth/logout", auth_headers(["Content-Type: application/json"]), HTTPClient.METHOD_POST, "{}") != OK:
		req.queue_free()
