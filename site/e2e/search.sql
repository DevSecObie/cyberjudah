-- Local Wrangler database only. Never run this fixture against a remote database.
DROP TABLE IF EXISTS search_docs;
CREATE VIRTUAL TABLE search_docs USING fts5(kind UNINDEXED, title, url UNINDEXED, sub, text, book UNINDEXED, chapter UNINDEXED, tokenize='porter unicode61');
INSERT INTO search_docs VALUES
('verse','Genesis 1:1','/bible/genesis/1#v1','','In the beginning God created the heaven and the earth.','Genesis',1),
('verse','John 1:1','/bible/john/1#v1','','In the beginning was the Word, and the Word was with God, and the Word was God.','John',1),
('verse','Scattered words','/bible/genesis/1#v2','','In another place the story has a beginning.','Genesis',1);
