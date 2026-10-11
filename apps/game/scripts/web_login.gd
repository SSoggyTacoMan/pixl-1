extends RefCounted

## Web login, code flow: the browser goes to the server's /auth/hackclub with a
## `state` nonce we keep in localStorage, Hack Club Auth sends it back here as
## `?code=...&state=...`, and the game trades the one-time code for a session
## token with POST /auth/exchange. No session token is ever put in a URL.

const _begin_js := """(function(){
	try {
		var ttl = 10 * 60 * 1000;
		var bytes = new Uint8Array(16);
		crypto.getRandomValues(bytes);
		var nonce = Array.from(bytes, function(b){ return b.toString(16).padStart(2, '0'); }).join('');
		localStorage.setItem('pixl_game_login_nonce', nonce + '.' + (Date.now() + ttl));
		return nonce;
	} catch (e) { return ''; }
})()"""

# Where the server sends the browser back to: the play origin's root. Only
# https origins are allowlisted server-side, so anything else is refused here.
const _return_url_js := """(function(){
	try {
		if (location.protocol !== 'https:') return '';
		return location.origin + '/';
	} catch (e) { return ''; }
})()"""

# Reads code + state off the URL, always strips them (so a reload or a shared
# link never replays them), and only hands the code back when state matches the
# unexpired nonce this tab stored before leaving.
const _take_js := """(function(){
	var code = '', state = '';
	try {
		var u = new URL(location.href);
		var p = u.searchParams;
		code = p.get('code') || '';
		state = p.get('state') || '';
		var dirty = false;
		['code', 'state'].forEach(function(k){ if (p.has(k)) { p.delete(k); dirty = true; } });
		if (dirty) {
			var qs = p.toString();
			history.replaceState({}, document.title, u.pathname + (qs ? '?' + qs : '') + u.hash);
		}
	} catch (e) {}
	if (!code) return '';
	try {
		var stored = (localStorage.getItem('pixl_game_login_nonce') || '').split('.');
		localStorage.removeItem('pixl_game_login_nonce');
		if (state && stored[0] && Number(stored[1]) > Date.now() && state === stored[0]) return code;
	} catch (e) {}
	return '';
})()"""

static func begin() -> String:
	var nonce = JavaScriptBridge.eval(_begin_js, true)
	return String(nonce) if typeof(nonce) == TYPE_STRING else ""

static func return_url() -> String:
	var url = JavaScriptBridge.eval(_return_url_js, true)
	return String(url) if typeof(url) == TYPE_STRING else ""

## The verified one-time login code, or "" when this load isn't a login return
## (or the state didn't match).
static func take_code() -> String:
	var code = JavaScriptBridge.eval(_take_js, true)
	return String(code) if typeof(code) == TYPE_STRING else ""
