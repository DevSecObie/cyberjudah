# Four cases held back from the previous pass for want of a recorded sentence, added 2026-09.
# The `unrecorded` verdict is exactly for this: the offense and the statute stand written, and
# scripture does not record the sentence. A case is what happened and what law it broke, not
# what punishment followed. Run scripts/cases-merge.py.
# Every reference was read out of the KJVA text in data/bible before it was written.
def R(book, ch, vv=None):
    return {"book": book, "chapter": ch, **({"verses": vv} if vv else {})}

CASES = [
 # ---------------- Divided Kingdom ----------------
 dict(slug="the-old-prophet-of-bethel", name="The old prophet of Beth-el", era="Divided Kingdom",
  charge="Lying in the name of the Lord, and claiming an angel's word to turn a prophet from his charge", verdict="unrecorded",
  summary="An old prophet in Beth-el heard what the man of God had done, rode after him, and brought him home to eat by claiming an angel had told him to. The text states it flatly: but he lied unto him. The lie killed the man who believed it, and then the same mouth pronounced his sentence over the table.",
  offense="His sons told him all the works the man of God had done that day. He saddled his ass, found him sitting under an oak, and said, Come home with me, and eat bread. The man of God refused: it was said to me by the word of the Lord, Thou shalt eat no bread nor drink water there. Then the old prophet said, I am a prophet also as thou art; and an angel spake unto me by the word of the Lord, saying, Bring him back with thee into thine house, that he may eat bread and drink water. But he lied unto him. He put his own invention into the mouth of God and hung an angel on it.",
  judgment="Against the old prophet, nothing. The word of the Lord came to him as they sat at the table, and he cried the sentence over the guest he had deceived: thy carcase shall not come unto the sepulchre of thy fathers. A lion met the man of God by the way and slew him. The liar buried him in his own grave, mourned Alas, my brother, and asked to be laid beside his bones, confessing that the word cried against the altar shall surely come to pass. He is the one man in the chapter who deceives, is proved right, and walks away.",
  refs=[R("1 Kings",13,"11-14"),R("1 Kings",13,"15-17"),R("1 Kings",13,"18-19"),R("1 Kings",13,"20-22"),R("1 Kings",13,"23-26"),R("1 Kings",13,"29-32"),R("Deuteronomy",18,"20"),R("Jeremiah",23,"25-26")],
  laws=["20F","3E","4D","2K"], topics=["false-prophets","lying","prophetic-warnings","believe"],
  themes=["false-prophecy","deceit","disobedience","testing-the-word"]),

 # ---------------- Exile and Return ----------------
 dict(slug="the-chaldeans-who-accused-the-jews", name="The Chaldeans who accused the Jews", era="Exile and Return",
  charge="Informing against the Jews to have them cast into the furnace for keeping the second commandment", verdict="unrecorded",
  summary="Certain Chaldeans came near and accused the Jews, reciting the king's own decree back to him and naming the three men who would not bow. They did not come for an offense against themselves; they came because Shadrach, Meshach and Abed-nego kept the commandment, and the decree made that a capital matter.",
  offense="At that time certain Chaldeans came near, and accused the Jews. They rehearsed the decree to Nebuchadnezzar — every man that shall hear the sound of the cornet shall fall down and worship the golden image, and whoso falleth not down shall be cast into the midst of a burning fiery furnace — and then laid the charge: There are certain Jews whom thou hast set over the affairs of the province of Babylon, Shadrach, Meshach, and Abed-nego; these men, O king, have not regarded thee: they serve not thy gods, nor worship the golden image which thou hast set up. Envy of men set over the province, dressed as loyalty to the king.",
  judgment="No sentence is recorded against the accusers. The fire they called for killed the wrong men: because the king's commandment was urgent, and the furnace exceeding hot, the flame of the fire slew those men that took up Shadrach, Meshach, and Abed-nego. The three came forth with no smell of fire upon them, the king blessed their God and decreed death to any that spake amiss against him, and promoted the men the Chaldeans had accused. In Daniel's own case later the accusers were themselves cast to the lions; here the record simply lets the accusation fail.",
  refs=[R("Daniel",3,"8-9"),R("Daniel",3,"10-12"),R("Daniel",3,"19-21"),R("Daniel",3,"22-23"),R("Daniel",3,"26-27"),R("Daniel",3,"28-30"),R("Daniel",6,"24"),R("Exodus",20,"4-5")],
  laws=["4E","3F","2D","17B"], topics=["witnesses","persecution","idolatry","our-enemies"],
  themes=["false-accusation","envy","idolatry","deliverance"]),

 # ---------------- Apostolic ----------------
 dict(slug="the-false-witnesses-against-stephen", name="The false witnesses against Stephen", era="Apostolic",
  charge="Suborning witnesses and stirring up the council against a man they could not answer", verdict="unrecorded",
  summary="They disputed with Stephen and were not able to resist the wisdom and the spirit by which he spake. So they suborned men to say he had spoken blasphemous words against Moses and against God, stirred up the people and the elders, and set up false witnesses before the council. Losing an argument, they bought a charge.",
  offense="There arose certain of the synagogue of the Libertines, and Cyrenians, and Alexandrians, and of them of Cilicia and of Asia, disputing with Stephen. And they were not able to resist the wisdom and the spirit by which he spake. Then they suborned men, which said, We have heard him speak blasphemous words against Moses, and against God. They stirred up the people, and the elders, and the scribes, caught him, brought him to the council, and set up false witnesses. The law they claimed to defend requires the false witness to bear the penalty he sought for his brother.",
  judgment="No sentence is recorded on them. They got what they came for: the council gnashed on Stephen with their teeth, stopped their ears, ran upon him with one accord, cast him out of the city and stoned him, and the witnesses laid down their clothes at a young man's feet, whose name was Saul. The last word spoken over them is the dying man's: Lord, lay not this sin to their charge. The young man who kept their clothes was afterward made the apostle to the Gentiles.",
  refs=[R("Acts",6,"9-10"),R("Acts",6,"11-12"),R("Acts",6,"13-14"),R("Acts",7,"54-57"),R("Acts",7,"58-60"),R("Acts",22,"20"),R("Deuteronomy",19,"16-19"),R("Exodus",20,"16")],
  laws=["4E","3E","10F","19E"], topics=["witnesses","persecution","lying","false-brethren"],
  themes=["false-witness","martyrdom","conspiracy","forgiveness"]),

 dict(slug="the-magistrates-of-philippi", name="The magistrates of Philippi", era="Apostolic",
  charge="Beating and imprisoning uncondemned Romans on the word of a mob", verdict="temporal",
  summary="The masters of the damsel lost their gains and brought Paul and Silas to the magistrates on a charge about customs. The magistrates rent off their clothes, commanded to beat them, laid many stripes on them and cast them into prison — no trial, no condemnation, and two Roman citizens. In the morning they tried to send them away privily.",
  offense="When her masters saw that the hope of their gains was gone, they caught Paul and Silas and drew them into the marketplace unto the rulers, saying, These men, being Jews, do exceedingly trouble our city, and teach customs, which are not lawful for us to receive, neither to observe, being Romans. The multitude rose up together against them: and the magistrates rent off their clothes, and commanded to beat them. And when they had laid many stripes upon them, they cast them into prison. They heard no defence and passed no sentence; the mob was the trial.",
  judgment="They were made to undo it in person. When it was day the magistrates sent the serjeants, saying, Let those men go; but Paul said, They have beaten us openly uncondemned, being Romans, and have cast us into prison; and now do they thrust us out privily? nay verily; but let them come themselves and fetch us out. And the serjeants told these words unto the magistrates: and they feared, when they heard that they were Romans. And they came and besought them, and brought them out, and desired them to depart out of the city.",
  refs=[R("Acts",16,"19-21"),R("Acts",16,"22-24"),R("Acts",16,"35-37"),R("Acts",16,"38-39"),R("Deuteronomy",25,"1-3"),R("Deuteronomy",16,"18-19"),R("Acts",22,"25-29")],
  laws=["4F","8C","19B","19D"], topics=["judgement","persecution","our-enemies","strangers"],
  themes=["injustice","mob","imprisonment","citizenship"]),
]
