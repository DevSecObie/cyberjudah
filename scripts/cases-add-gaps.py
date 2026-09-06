# Case studies still missing after the 2026-09 pass, added 2026-09. Run scripts/cases-merge.py.
# Every reference below was read out of the KJVA text in data/bible before it was written,
# and checked back against it with scripts/cases-check.py.
def R(book, ch, vv=None):
    return {"book": book, "chapter": ch, **({"verses": vv} if vv else {})}

CASES = [
 # ---------------- Patriarchal ----------------
 dict(slug="potiphars-wife", name="Potiphar's wife", era="Patriarchal",
  charge="Soliciting her husband's servant day by day, and bearing false witness against him when he fled", verdict="unrecorded",
  summary="She asked Joseph to lie with her and he refused, telling her it would be a great wickedness and a sin against God. When she caught him by the garment and he left it in her hand and fled, she kept the garment and turned it into evidence against him. The record gives her offense and the statute it breaks, and never gives her sentence.",
  offense="His master's wife cast her eyes upon Joseph and said, Lie with me. She spake to Joseph day by day, and he hearkened not unto her. Finding him in the house with none of the men within, she caught him by his garment; he left it in her hand and got him out. She then called unto the men of her house and said, See, he hath brought in an Hebrew unto us to mock us; he came in unto me to lie with me, and I cried with a loud voice — and she laid up his garment by her until his lord came home, and spake to him according to these words.",
  judgment="The judgment recorded falls on the innocent man: his master's wrath was kindled, and Joseph's master took him and put him into the prison, a place where the king's prisoners were bound. Against the woman scripture records nothing at all. Her offense is a double one under the law — the solicitation, and then the false witness that carried the penalty of the crime she charged — and both stand written with no sentence set against them.",
  refs=[R("Genesis",39,"7-10"),R("Genesis",39,"11-15"),R("Genesis",39,"16-20"),R("Exodus",20,"14"),R("Exodus",20,"16"),R("Deuteronomy",19,"16-19"),R("Psalms",105,"17-19")],
  laws=["5D","5E","4E","3E"], topics=["adultery","witnesses","false-brethren","temptation"],
  themes=["sexual-immorality","false-witness","deceit","imprisonment"]),

 # ---------------- Egypt ----------------
 dict(slug="moses-and-the-egyptian", name="Moses, and the Egyptian in the sand", era="Egypt",
  charge="Slaying an Egyptian and hiding him in the sand", verdict="temporal",
  summary="Moses went out to his brethren, saw an Egyptian smiting a Hebrew, looked this way and that, and slew him. He supposed his brethren would have understood that God by his hand would deliver them; they understood not, and the man who did the wrong threw the killing in his face. Forty years in Midian were the sentence.",
  offense="When Moses was grown he went out unto his brethren and looked on their burdens, and he spied an Egyptian smiting an Hebrew, one of his brethren. He looked this way and that way, and when he saw that there was no man, he slew the Egyptian, and hid him in the sand. The looking about and the hiding are the record's own witness that he knew what he did.",
  judgment="The next day two Hebrews strove, and he that did the wrong said, Who made thee a prince and a judge over us? intendest thou to kill me, as thou killedst the Egyptian? And Moses feared, and said, Surely this thing is known. Pharaoh heard the thing and sought to slay Moses, and Moses fled from the face of Pharaoh and dwelt in the land of Midian, a stranger, where he begat two sons. He came back at eighty to the work he had tried to begin at forty.",
  refs=[R("Exodus",2,"11-12"),R("Exodus",2,"13-15"),R("Acts",7,"24-29"),R("Hebrews",11,"24-27"),R("Exodus",20,"13"),R("Numbers",35,"33")],
  laws=["10A","10I","19E","8C"], topics=["murder","judgement","our-enemies","deliverance"],
  themes=["bloodshed","exile","deliverance","zeal"]),

 dict(slug="the-magicians-of-egypt", name="The magicians of Egypt", era="Egypt",
  charge="Withstanding Moses with their enchantments, and hardening Pharaoh in his refusal", verdict="plague",
  summary="Pharaoh called the wise men and the sorcerers, and they matched the rod and the blood and the frogs with their enchantments. At the lice they could not, and said, This is the finger of God. At the boils they could not so much as stand before Moses, because the boil was upon them.",
  offense="Pharaoh also called the wise men and the sorcerers: now the magicians of Egypt, they also did in like manner with their enchantments. For they cast down every man his rod, and they became serpents. Each imitation they managed was another reason for Pharaoh to harden his heart and not hearken; the craft was witchcraft, and its use was to hold a king in his sin.",
  judgment="Aaron's rod swallowed up their rods. The magicians did so with their enchantments to bring forth lice, but they could not, and said unto Pharaoh, This is the finger of God. Then the magicians could not stand before Moses because of the boils; for the boil was upon the magicians, and upon all the Egyptians. Paul names them Jannes and Jambres and gives the standing sentence on all who withstand the truth after them: they shall proceed no further, for their folly shall be manifest unto all men, as theirs also was.",
  refs=[R("Exodus",7,"10-13"),R("Exodus",8,"16-19"),R("Exodus",9,"8-11"),R("2 Timothy",3,"8-9"),R("Deuteronomy",18,"10-12"),R("Exodus",22,"18")],
  laws=["10D","2G","2D","20F"], topics=["divination","abomination","false-prophets","other-gods"],
  themes=["sorcery","hardening","plagues","false-signs"]),

 # ---------------- Judges ----------------
 dict(slug="succoth-and-penuel", name="The men of Succoth and Penuel", era="Judges",
  charge="Refusing bread to the Lord's army in pursuit, and taunting them with it", verdict="death",
  summary="Gideon and his three hundred came to Jordan faint, yet pursuing, and asked loaves of bread. Succoth and Penuel both answered with a sneer: are the hands of Zebah and Zalmunna now in thine hand, that we should give bread unto thine army? He told them what he would do when he came back, and he came back.",
  offense="Gideon asked the men of Succoth for bread for people that were faint while he pursued the kings of Midian, and the princes of Succoth mocked the request. He went up to Penuel and spake likewise, and the men of Penuel answered him as the men of Succoth had answered him. It was their own deliverer, in the Lord's pursuit, asking bread of his own countrymen.",
  judgment="Gideon returned from battle with Zebah and Zalmunna, caught a young man of Succoth who described the princes and elders, threescore and seventeen men, and took the elders of the city, and thorns of the wilderness and briers, and with them he taught the men of Succoth. And he beat down the tower of Penuel, and slew the men of the city.",
  refs=[R("Judges",8,"4-6"),R("Judges",8,"7-9"),R("Judges",8,"13-16"),R("Judges",8,"17"),R("Deuteronomy",23,"3-4"),R("Isaiah",58,"7"),R("Proverbs",3,"27")],
  laws=["15A","3A","22B","11B"], topics=["giving","alms-deliver","brethren","our-enemies"],
  themes=["hospitality-refused","reproach","retribution","war"]),

 # ---------------- United Monarchy ----------------
 dict(slug="the-sons-of-samuel", name="Joel and Abiah, the sons of Samuel", era="United Monarchy",
  charge="Turning aside after lucre, taking bribes, and perverting judgment in the seat of the judge", verdict="unrecorded",
  summary="Samuel made his sons judges over Israel, and they walked not in his ways. They took bribes and perverted judgment, and the elders of Israel used it as the reason to ask for a king. The sentence recorded falls on the nation that asked, not on the two men who gave them the excuse.",
  offense="When Samuel was old he made his sons judges over Israel in Beer-sheba. His sons walked not in his ways, but turned aside after lucre, and took bribes, and perverted judgment — the three things the law forbids a judge by name, since the gift blindeth the eyes of the wise and perverteth the words of the righteous.",
  judgment="Scripture records no sentence upon Joel and Abiah. What it records is the consequence: all the elders of Israel gathered to Samuel at Ramah and said, Behold, thou art old, and thy sons walk not in thy ways: now make us a king to judge us like all the nations. Their corruption became the argument for the kingdom, and the judgment that followed fell on the people who made it.",
  refs=[R("1 Samuel",8,"1-3"),R("1 Samuel",8,"4-5"),R("Deuteronomy",16,"18-20"),R("Exodus",23,"8"),R("1 Samuel",12,"3-4"),R("1 Samuel",2,"12")],
  laws=["4C","4F","8C","19B"], topics=["bribe","judgement","money","covet"],
  themes=["corruption","judgeship","inheritance-of-office","kingship"]),

 # ---------------- Divided Kingdom ----------------
 dict(slug="hazael", name="Hazael king of Syria", era="Divided Kingdom",
  charge="Smothering his master to take the throne, and doing to Israel the evil Elisha wept over", verdict="death",
  summary="Elisha looked at Hazael and wept, and told him why: he knew the evil he would do to the children of Israel. Hazael said, Is thy servant a dog, that he should do this great thing? He went home, lied to his master about the prophet's word, and smothered him with a wet cloth the next morning.",
  offense="Sent to ask whether Ben-hadad should recover, Hazael carried back the opposite of what he was told: Elisha said, He told me that thou shouldest surely recover, when the man of God had said the Lord shewed him he shall surely die. On the morrow he took a thick cloth, and dipped it in water, and spread it on his face, so that he died: and Hazael reigned in his stead. Then he did what Elisha foresaw — set the strong holds on fire, slay the young men with the sword, dash the children and rip up the women with child.",
  judgment="In those days the Lord began to cut Israel short, and Hazael smote them in all the coasts of Israel; he was the rod, and the rod was not spared. Amos names Damascus for three transgressions and for four, because they have threshed Gilead with threshing instruments of iron: I will send a fire into the house of Hazael, which shall devour the palaces of Ben-hadad, and the people of Syria shall go into captivity unto Kir.",
  refs=[R("2 Kings",8,"7-10"),R("2 Kings",8,"11-13"),R("2 Kings",8,"14-15"),R("2 Kings",10,"32-33"),R("Amos",1,"3-5"),R("Isaiah",10,"5-7"),R("Exodus",20,"13")],
  laws=["10A","10G","11A","2P"], topics=["murder","our-enemies","judgement-of-nations","lying"],
  themes=["bloodshed","usurpation","oppression","foreign-judgment"]),

 dict(slug="menahem", name="Menahem king of Israel", era="Divided Kingdom",
  charge="Ripping up the women with child at Tiphsah, and buying Assyria with money exacted from Israel", verdict="unrecorded",
  summary="Menahem came up from Tirzah, killed Shallum, and took the throne. When Tiphsah would not open to him he smote it and ripped up all the women therein that were with child. He then paid Pul a thousand talents of silver, exacted from the wealthy of Israel, to confirm the kingdom in his hand — and died in his bed.",
  offense="Menahem smote Tiphsah, and all that were therein, and the coasts thereof from Tirzah: because they opened not to him, therefore he smote it; and all the women therein that were with child he ripped up. He did that which was evil in the sight of the Lord: he departed not all his days from the sins of Jeroboam the son of Nebat, who made Israel to sin. Pul the king of Assyria came against the land, and Menahem gave Pul a thousand talents of silver, exacting the money of Israel, of each mighty man of wealth fifty shekels.",
  judgment="Upon Menahem himself, nothing: he reigned ten years in Samaria, and Menahem slept with his fathers, and Pekahiah his son reigned in his stead. The sentence fell on what he bought. The silver that turned Assyria back the first time brought Assyria back for the rest, and the kingdom he confirmed in his own hand went into captivity within a generation, for the sins of Jeroboam he would not depart from.",
  refs=[R("2 Kings",15,"14-16"),R("2 Kings",15,"17-18"),R("2 Kings",15,"19-20"),R("2 Kings",15,"21-22"),R("2 Kings",17,"6-7"),R("Hosea",13,"16"),R("Amos",1,"13")],
  laws=["10A","2D","11C","16E"], topics=["murder","other-gods","money","judgement-of-nations"],
  themes=["bloodshed","tribute","alliance","kingship"]),

 # ---------------- Exile and Return ----------------
 dict(slug="sanballat-geshem-and-noadiah", name="Sanballat, Geshem, and Noadiah", era="Exile and Return",
  charge="Mocking, conspiring, and hiring prophecy to frighten the builder off the wall", verdict="unrecorded",
  summary="They laughed the work to scorn, then mocked it, then sent four times to draw Nehemiah down to the plain of Ono, then wrote an open letter accusing him of rebellion, then hired a prophet to make him sin in fear. Nehemiah answered every stage and finished the wall, and left their case with God.",
  offense="Sanballat the Horonite, Tobiah the Ammonite, and Geshem the Arabian laughed us to scorn, and despised us, and said, Will ye rebel against the king? Sanballat mocked before the army of Samaria: What do these feeble Jews? Sanballat and Geshem sent four times to meet in the plain of Ono, but they thought to do me mischief, then an open letter charging that Nehemiah built the wall to be their king. They all made us afraid, saying, Their hands shall be weakened from the work. Last they hired a prophet, and Noadiah the prophetess with the rest, to put him in fear.",
  judgment="No sentence is recorded against them. What is recorded is the prayer that stands in place of one — My God, think thou upon Tobiah and Sanballat according to these their works, and on the prophetess Noadiah, and the rest of the prophets, that would have put me in fear — and the answer that came instead of a verdict: the wall was finished, and all the heathen about them perceived that this work was wrought of our God.",
  refs=[R("Nehemiah",2,"19-20"),R("Nehemiah",4,"1-3"),R("Nehemiah",6,"1-4"),R("Nehemiah",6,"5-9"),R("Nehemiah",6,"12-14"),R("Nehemiah",6,"15-16"),R("Deuteronomy",18,"20-22")],
  laws=["20F","3E","3I","13D"], topics=["false-prophets","persecution","fear","our-enemies"],
  themes=["opposition","false-prophecy","conspiracy","rebuilding"]),

 # ---------------- Second Temple (Apocrypha) ----------------
 dict(slug="the-men-of-joppa", name="The men of Joppa", era="Second Temple (Apocrypha)",
  charge="Drowning two hundred of the Jews that dwelt among them, under a pretence of peace", verdict="death",
  summary="The men of Joppa invited the Jews living in their city, with their wives and children, into boats they had prepared, as though they meant them no hurt. The Jews accepted by common decree of the city, suspecting nothing. When they were out in the deep, the Joppites drowned no less than two hundred of them.",
  offense="They prayed the Jews that dwelt among them to go with their wives and children into the boats which they had prepared, as though they had meant them no hurt. Who accepted of it according to the common decree of the city, as being desirous to live in peace, and suspecting nothing: but when they were gone forth into the deep, they drowned no less than two hundred of them. The invitation itself was the weapon; the men of Jamnia were minded to do in like manner.",
  judgment="When Judas heard of this cruelty done unto his countrymen, he commanded those that were with him to make them ready, and calling upon God the righteous Judge, he came against those murderers of his brethren, and burnt the haven by night, and set the boats on fire, and those that fled thither he slew. He came upon the Jamnites also by night and set fire on their haven and navy, so that the light of the fire was seen at Jerusalem two hundred and forty furlongs off.",
  refs=[R("2 Maccabees",12,"3-4"),R("2 Maccabees",12,"5-7"),R("2 Maccabees",12,"8-9"),R("Exodus",20,"13"),R("Proverbs",1,"11-16"),R("Psalms",55,"20-21")],
  laws=["10A","3J","22D","19E"], topics=["murder","lying","our-enemies","judgement"],
  themes=["treachery","bloodshed","retribution","war"]),

 # ---------------- Gospels ----------------
 dict(slug="the-chief-priests-and-the-watch", name="The chief priests, and the watch at the sepulchre", era="Gospels",
  charge="Paying the soldiers large money to report a lie about the resurrection", verdict="unrecorded",
  summary="They had asked Pilate for a watch so the disciples could not steal the body and say he is risen. When the watch came into the city and told them all the things that were done, they assembled with the elders, took counsel, and bought the story they had set the guard to prevent.",
  offense="The chief priests and Pharisees came to Pilate saying, Command therefore that the sepulchre be made sure until the third day, lest his disciples come by night, and steal him away; so they sealed the stone and set a watch. When some of the watch came into the city and shewed all the things that were done, they were assembled with the elders, and had taken counsel, and gave large money unto the soldiers, saying, Say ye, His disciples came by night, and stole him away while we slept — and promised, if this come to the governor's ears, we will persuade him, and secure you.",
  judgment="No sentence is recorded on them here. The record instead marks how long the purchased lie outlasted the purchase: so they took the money, and did as they were taught: and this saying is commonly reported among the Jews until this day. They bribed the witnesses of the thing they most needed not to be true, and the men they hired were the only witnesses they had.",
  refs=[R("Matthew",27,"62-64"),R("Matthew",27,"65-66"),R("Matthew",28,"11-13"),R("Matthew",28,"14-15"),R("Exodus",23,"1"),R("Proverbs",19,"5"),R("Exodus",20,"16")],
  laws=["4C","4E","3E","20F"], topics=["bribe","witnesses","money","persecution"],
  themes=["false-witness","bribery","conspiracy","resurrection"]),

 # ---------------- Apostolic ----------------
 dict(slug="demetrius-and-the-silversmiths", name="Demetrius and the silversmiths of Ephesus", era="Apostolic",
  charge="Raising an uproar over lost trade under the colour of zeal for Diana", verdict="unrecorded",
  summary="Demetrius called the craftsmen together and told them plainly what was at stake — Sirs, ye know that by this craft we have our wealth — then dressed the grievance up as danger to the temple of the great goddess. The city filled with confusion for two hours, and the townclerk sent them home.",
  offense="A certain man named Demetrius, a silversmith, which made silver shrines for Diana, brought no small gain unto the craftsmen. He called them together and said that Paul had persuaded and turned away much people, saying that they be no gods, which are made with hands: so that not only this our craft is in danger to be set at nought, but also that the temple of the great goddess Diana should be despised. They were full of wrath, and the whole city was filled with confusion, and they caught Gaius and Aristarchus and rushed into the theatre.",
  judgment="No sentence is recorded upon Demetrius. The townclerk appeased the people and gave the verdict the law would have given: ye ought to be quiet, and to do nothing rashly; for ye have brought hither these men, which are neither robbers of churches, nor yet blasphemers of your goddess. If Demetrius, and the craftsmen which are with him, have a matter against any man, the law is open, and there are deputies: let them implead one another. And he warned them they were in danger to be called in question for this day's uproar, there being no cause — then dismissed the assembly.",
  refs=[R("Acts",19,"23-25"),R("Acts",19,"26-28"),R("Acts",19,"29"),R("Acts",19,"35-38"),R("Acts",19,"39-41"),R("Exodus",20,"4"),R("Isaiah",44,"9-11")],
  laws=["2D","17C","19A","4A"], topics=["idolatry","covet","money","persecution"],
  themes=["idolatry","greed","tumult","law-and-order"]),

 dict(slug="felix", name="Felix the governor", era="Apostolic",
  charge="Trembling at the judgment to come, hoping for a bribe, and leaving a man he knew to be innocent bound", verdict="unrecorded",
  summary="Felix sent for Paul and heard him concerning the faith in Christ, and as Paul reasoned of righteousness, temperance and judgment to come, he trembled. He put it off for a convenient season that never came, sent for Paul the oftener hoping for money, and after two years handed him on still bound, to do the Jews a pleasure.",
  offense="Felix heard Paul concerning the faith in Christ, and as he reasoned of righteousness, temperance, and judgment to come, Felix trembled, and answered, Go thy way for this time; when I have a convenient season, I will call for thee. He hoped also that money should have been given him of Paul, that he might loose him: wherefore he sent for him the oftener, and communed with him. A judge who has heard the case, felt the truth of it, and wants paying to do what he already knows is right.",
  judgment="Scripture records no sentence upon Felix. It records only what he did with the two years he was given: after two years Porcius Festus came into Felix' room: and Felix, willing to shew the Jews a pleasure, left Paul bound. The convenient season is the whole of his judgment — he was moved, and asked for money, and was replaced, and the man he trembled before went to Rome in chains.",
  refs=[R("Acts",24,"24-25"),R("Acts",24,"26-27"),R("Exodus",23,"8"),R("Deuteronomy",16,"19"),R("Proverbs",17,"15"),R("2 Corinthians",6,"2")],
  laws=["4C","4F","8C","2L"], topics=["bribe","judgement","repentance","money"],
  themes=["bribery","procrastination","injustice","conviction"]),

 dict(slug="the-judaizers", name="They that troubled the churches with circumcision", era="Apostolic",
  charge="Preaching another gospel, subverting souls with a commandment the apostles never gave", verdict="curse",
  summary="Certain men came down from Judea teaching that except ye be circumcised after the manner of Moses, ye cannot be saved. The council at Jerusalem disowned them by name — to whom we gave no such commandment — and Paul, writing to Galatia, put them under a curse twice over in two verses.",
  offense="Certain men which came down from Judea taught the brethren, Except ye be circumcised after the manner of Moses, ye cannot be saved; and there rose up certain of the sect of the Pharisees which believed, saying that it was needful to circumcise them, and to command them to keep the law of Moses. The apostles' letter names the offense exactly: certain which went out from us have troubled you with words, subverting your souls, saying, Ye must be circumcised, and keep the law: to whom we gave no such commandment. In Galatia the same men removed the churches so soon unto another gospel.",
  judgment="The sentence is pronounced and repeated: though we, or an angel from heaven, preach any other gospel unto you than that which we have preached unto you, let him be accursed. As we said before, so say I now again, If any man preach any other gospel unto you than that ye have received, let him be accursed. And to the Galatians: he that troubleth you shall bear his judgment, whosoever he be. I would they were even cut off which trouble you.",
  refs=[R("Acts",15,"1-2"),R("Acts",15,"5"),R("Acts",15,"22-24"),R("Galatians",1,"6-7"),R("Galatians",1,"8-9"),R("Galatians",5,"7-10"),R("Galatians",5,"11-12")],
  laws=["20F","2F","3A","20C"], topics=["false-brethren","heresy","good-doctrine","church"],
  themes=["false-teaching","curse","apostolic-authority","division"]),

 dict(slug="pergamos", name="The church in Pergamos", era="Apostolic",
  charge="Holding among them the doctrine of Balaam and the doctrine of the Nicolaitans", verdict="reprieve",
  summary="Pergamos held fast his name and had not denied his faith, even where Satan's seat is, and in the days when Antipas was slain among them. The commendation stands; so does the charge. They kept the name and kept the teachers with it, and the sentence is suspended on one word: repent.",
  offense="I know thy works, and where thou dwellest, even where Satan's seat is: and thou holdest fast my name, and hast not denied my faith. But I have a few things against thee, because thou hast there them that hold the doctrine of Balaam, who taught Balac to cast a stumblingblock before the children of Israel, to eat things sacrificed unto idols, and to commit fornication. So hast thou also them that hold the doctrine of the Nicolaitans, which thing I hate. The fault is not that they taught it, but that they had them there.",
  judgment="Repent; or else I will come unto thee quickly, and will fight against them with the sword of my mouth. The sentence is pronounced and held: he which hath the sharp sword with two edges names the weapon he will use, and stays it on their repentance. To him that overcometh will I give to eat of the hidden manna, and will give him a white stone, and in the stone a new name written, which no man knoweth saving he that receiveth it.",
  refs=[R("Revelation",2,"12-13"),R("Revelation",2,"14-15"),R("Revelation",2,"16-17"),R("Numbers",25,"1-2"),R("Numbers",31,"16"),R("Acts",15,"28-29"),R("Revelation",2,"6")],
  laws=["2D","5E","20C","20F"], topics=["idolatry","spiritual-fornication","church","repentance"],
  themes=["false-teaching","enticement","idolatry","repentance"]),
]
