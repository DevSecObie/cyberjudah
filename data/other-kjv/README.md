# Gods, creatures and titles from the KJV

Names in the KJV with Apocrypha that are not people: the idols and other gods (Baal,
Ashtaroth, Dagon, Molech, Chemosh, ...), creatures (Leviathan, Behemoth) and titles
(Tirshatha). Nothing here comes from STEPBible or TIPNR.

`other.json` is built with `people.json` by `python3 scripts/people-kjv/build.py`, from the
same hand-kept `data/people-kjv/sources/<book>.names.txt` files. A names line with type `D`
is a god or idol, `C` a creature and `T` a title; each record cites every verse that names
it, the same as a person. `kind` in `other.json` is `God`, `Creature` or `Title`.
