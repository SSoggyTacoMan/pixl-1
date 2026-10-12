// Pixo talks to thousands of minors, mostly in DMs. Whatever it "remembers"
// about someone can be replayed into a channel reply, a roast, or another
// user's /pixl-mymemory lookup, so identity details must never be stored or
// read back: real name, age/birthday/grade, location, nationality, school,
// pronouns/gender/orientation, contact info, family, relationships, religion
// and health. Only harmless preferences and interests survive.
//
// This runs twice: on write (extractMemory/extractPersonality drop matching
// facts before saving) and on read (every consumer goes through safeFacts()),
// so rows already sitting in user_memory from before this filter existed are
// never surfaced either. It is deliberately over-eager: losing "learned rust
// from his brother" is fine, leaking a kid's city is not.

const IDENTITY_PATTERNS: RegExp[] = [
  // names (display names come from the Slack profile via getDisplayName;
  // a legacy "name is X" fact is dropped like any other name)
  /\b(real|full|first|last|legal|sur|given|middle|birth|maiden)\s*-?\s*name\b/i,
  /\b(my|their|his|her|the author'?s?)\s+name\b/i,
  /\bname\s+is\b/i,
  /\bgoes\s+by\b/i,
  // age, birthday, grade
  /\b\d{1,3}\s*-?\s*(years?|yrs?|y\/?o|yo)\b/i,
  /\b(age|aged|ages)\b/i,
  /\b(is|am|turning|turned)\s+\d{1,2}\b/i,
  /\b(i['’]?m|im|i\s+am)\s+\d{1,2}\b/i,
  /\bturns?\s+\d{1,2}\b/i,
  /\b\d{1,3}\s*y\.\s*o\b\.?/i,
  /\b(birthday|bday|b-day|born|birth|birthdate|dob)\b/i,
  /\b\d{1,2}(st|nd|rd|th)\s+grade(r)?\b/i,
  /\bgrade\s*\d{1,2}\b/i,
  /\b(year|yr)\s*\d{1,2}\b/i,
  /\b(freshman|sophomore|teen|teenager|minor|underage|preteen|tween)\b/i,
  /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\s+grade(rs?)?\b/i,
  /\b(junior|senior)\s+(high|year)\b/i,
  // location and nationality
  /\b(lives?|living|based|located|resides?|residing|moved|moving|relocat\w*)\b/i,
  /\b(is|am|are|comes?|came|originally|hails?)\s+from\b/i,
  // Any case: "from ohio" leaks as much as "from Ohio". Over-eager on
  // purpose ("switched from python" goes too), see the header.
  /\bfrom\s+(the\s+)?[a-z]{2,}/i,
  /\bgrew\s+up\b/i,
  /\b(speaks?|speaking|fluent\s+in|native\s+speaker|mother\s+tongue|first\s+language)\b/i,
  /\b(city|town|country|state|province|county|village|hometown|region|suburb|neighbou?rhood|district)\b/i,
  /\b(nationality|national|citizen|citizenship|ethnicity|ethnic|immigrant|passport)\b/i,
  /\b(address|street|avenue|zip|zipcode|postcode|postal)\b/i,
  /\b(time\s*zone|timezone|utc|gmt|[ecmp][sd]t|ist|cet|cest|bst|aest)\b/i,
  /\b(american|british|english|scottish|welsh|irish|canadian|mexican|brazilian|argentin\w*|french|german|dutch|belgian|swiss|austrian|italian|spanish|portuguese|polish|ukrainian|russian|swedish|norwegian|danish|finnish|greek|turkish|indian|pakistani|bangladeshi|nepali|sri\s*lankan|chinese|japanese|korean|vietnamese|thai|filipin[oa]|indonesian|malaysian|singaporean|australian|kiwi|nigerian|kenyan|ghanaian|egyptian|moroccan|south\s*african|israeli|iranian|saudi|emirati)\b/i,
  /\b(usa|u\.s\.a?|uk|u\.k|america|britain|england|canada|india|france|germany|brazil|australia|china|japan|philippines|nigeria|pakistan|london|paris|new\s*york|california|texas|toronto|mumbai|delhi|bangalore|bengaluru|sydney|berlin)\b/i,
  // Spanish / French / Portuguese age and location phrasing
  /\b(tengo|tiene|tienes|cumpl[eoií]\w*)\s+\d{1,2}\b/i,
  /\b\d{1,2}\s*(a[ñn]os|ans|anos)\b/i,
  /\b(vivo|vive|vives|viven|vivimos|moro|mora)\s+en\b/i,
  /\b(vivo|vive|moro|mora)\s+(em|no|na)\b/i,
  /\b(soy|eres|es|sou)\s+de\b/i,
  /\bj['’]?\s*(habite|ai\s+\d{1,2})\b/i,
  /\bhabit(e|es|ent|ons|ez|er)\s+(à|a|au|en)(?![a-z])/i,
  /\b(je\s+viens|il\s+vient|elle\s+vient)\s+d/i,
  // school
  /\b\w*school(ers?|ing|ed)\b/i,
  /\b(school|highschool|high-school|college|university|uni|academy|campus|homeschool\w*|classmates?|teachers?|principal|class\s+of|semester|gcse|a-levels?)\b/i,
  // pronouns, gender, orientation
  /\bpronouns?\b/i,
  /\b(he|she|they|xe|ze|it)\s*\/\s*(him|her|them|they|she|he|xem|zir|its)\b/i,
  /\b(trans|transgender|nonbinary|non-binary|enby|genderfluid|agender|gender|cis|cisgender)\b/i,
  /\b(gay|lesbian|bi|bisexual|pansexual|asexual|aroace|queer|homosexual|lgbtq?\+?|closeted|came\s+out)\b/i,
  /\b(boy|girl|male|female|man|woman)\b/i,
  // contact info and accounts
  /[^\s@]+@[^\s@]+\.[a-z]{2,}/i,
  /\+?\d[\d\s().-]{6,}\d/,
  /https?:\/\/|www\./i,
  /\b(phone|cell|mobile|number|email|e-mail|gmail|outlook|instagram|insta|snapchat|snap|discord|tiktok|twitter|whatsapp|telegram|facebook|reddit|handle|username)\b/i,
  /(^|\s)@\w+/,
  // family and relationships
  /\b(mom|mum|mother|dad|father|parents?|brothers?|sisters?|siblings?|sons?|daughters?|grand(ma|pa|mother|father|parents?)|aunt|uncle|cousins?|family|step\s*-?(mom|dad|mother|father|brother|sister)|guardian|foster|adopted|twin)\b/i,
  /\b(girlfriend|boyfriend|gf|bf|crush|dating|partner|married|wife|husband)\b/i,
  // religion and health
  /\b(religion|religious|muslim|islam|christian|catholic|hindu|jewish|sikh|buddhist|atheist|church|mosque|temple)\b/i,
  /\b(adhd|autis\w*|depress\w*|anxiety|diagnos\w*|disorder|disabilit\w*|therapy|therapist|medication|meds|illness|hospital)\b/i,
  // jobs reveal location/age just as easily
  /\b(works?\s+(at|for)|job\s+at|employed|employer)\b/i,
];

/** True if a stored fact/trait reveals (or plausibly reveals) who someone is. */
export function isIdentityFact(fact: string): boolean {
  return IDENTITY_PATTERNS.some((p) => p.test(fact));
}

/** Facts that are safe to store, show, or feed to a model. */
export function safeFacts(facts: readonly string[]): string[] {
  return facts.filter((f) => typeof f === "string" && !isIdentityFact(f));
}
