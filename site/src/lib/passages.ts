// A passage a day, deterministic from the date, so everyone sees the same one and there is a
// reason to come back tomorrow. The first entry renders on the server; the browser swaps in
// the day's passage on mount so hydration always matches.
export const PASSAGES = [
  { lead: "Thy word is a lamp", rest: " unto my feet, and a light unto my path.", ref: "Psalms 119:105", to: "/bible/psalms/119#v105", file: "psalms/119.txt" },
  { lead: "Wisdom is the principal thing", rest: "; therefore get wisdom: and with all thy getting get understanding.", ref: "Proverbs 4:7", to: "/bible/proverbs/4#v7", file: "proverbs/4.txt" },
  { lead: "Precept upon precept", rest: "; line upon line, line upon line; here a little, and there a little.", ref: "Isaiah 28:10", to: "/bible/isaiah/28#v10", file: "isaiah/28.txt" },
  { lead: "Ask for the old paths", rest: ", where is the good way, and walk therein, and ye shall find rest for your souls.", ref: "Jeremiah 6:16", to: "/bible/jeremiah/6#v16", file: "jeremiah/6.txt" },
  { lead: "Rightly dividing", rest: " the word of truth: study to shew thyself approved.", ref: "2 Timothy 2:15", to: "/bible/2-timothy/2#v15", file: "2-timothy/2.txt" },
  { lead: "In his law", rest: " doth he meditate day and night.", ref: "Psalms 1:2", to: "/bible/psalms/1#v2", file: "psalms/1.txt" },
  { lead: "To do justly, and to love mercy", rest: ", and to walk humbly with thy God.", ref: "Micah 6:8", to: "/bible/micah/6#v8", file: "micah/6.txt" },
  { lead: "The law of the Lord is perfect", rest: ", converting the soul.", ref: "Psalms 19:7", to: "/bible/psalms/19#v7", file: "psalms/19.txt" },
  { lead: "Destroyed for lack of knowledge", rest: ": because thou hast rejected knowledge, I will also reject thee.", ref: "Hosea 4:6", to: "/bible/hosea/4#v6", file: "hosea/4.txt" },
  { lead: "An holy people", rest: " unto the Lord thy God: the Lord thy God hath chosen thee to be a special people unto himself.", ref: "Deuteronomy 7:6", to: "/bible/deuteronomy/7#v6", file: "deuteronomy/7.txt" },
];
export function passageOfTheDay() {
  const n = new Date();
  const day = Math.floor(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) / 86400000);
  return PASSAGES[day % PASSAGES.length];
}
