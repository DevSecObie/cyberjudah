# Open edX courses from the study notes

`build_course.py` turns the 4 Chapters a Day notes in `docs/study/` into an Open edX course
that Studio can import. The notes stay the source: fix a note, rebuild, re-import.

```
python3 scripts/edx/build_course.py genesis --chapters 1     # the pilot: Genesis 1
python3 scripts/edx/build_course.py genesis --chapters 1-4   # the first reading session
python3 scripts/edx/build_course.py genesis                  # every chapter with a note
```

It writes `dist/edx/<book>.tar.gz` and needs nothing but Python 3.9+ (Pillow, if installed,
adds a course card image).

## Every course

```
python3 scripts/edx/build_all.py                 # all 105 courses, plus dist/edx/manifest.tsv
python3 scripts/edx/build_all.py --only classes  # or books, cases, topics
```

| Kind | Builder | Courses |
|---|---|---|
| Books | `build_course.py` | one per book of the Bible, Apocrypha included (81) |
| Classes | `build_series.py` | one per series or show: IUIC in the ClassRoom, Our Hidden History, 15 Minutes w/ The Captains, Giving The Sense From A to Z, and the rest (20) |
| Case Studies | `build_cases.py` | one course, a section per era, a subsection per case (337) |
| Topics | `build_topics.py` | The Law (handbook), Encyclopedia, Precepts |

All of them are plain OLX as described in the Open edX docs
([course structure](https://docs.openedx.org/en/latest/educators/olx/organizing-course/course-xml-file.html),
[video components](https://docs.openedx.org/en/latest/educators/olx/components/video-components.html),
[course policies](https://docs.openedx.org/en/latest/educators/olx/policies/course.html),
[grading policy](https://docs.openedx.org/en/latest/educators/olx/policies/grading.html)).
The lesson pages are plain text, headings and lists with no colours or styles of their own, so
they take the platform's theme, light or dark.

**Clips of a class.** A class unit plays only its part of the class: the video component's
`start_time` and `end_time`, taken from the timestamp where that scripture is opened in the note
to where the next one starts. The video stays on YouTube; nothing is downloaded or hosted.

`olx.check()` (run by `test_courses.py` on every course) makes sure each XML file parses, each
`url_name` points at a file that exists, and the only links are YouTube.

## How a book becomes a course

| Open edX      | From the notes                              | Example                                   |
|---------------|---------------------------------------------|-------------------------------------------|
| Course        | one book                                    | Genesis                                   |
| Section       | one reading session of four chapters        | Genesis 1-4                               |
| Subsection    | first in each section                       | About this reading                        |
| Subsection    | one chapter, graded when it has a quiz      | Genesis 1: The Creation of Light and Mankind |
| Unit          | what the chapter covers                     | Overview                                  |
| Unit          | the whole chapter (KJV)                     | Read Genesis 1                            |
| Unit          | each verse block, with its class clip       | Genesis 1:1-2                             |
| Unit          | `quizzes/<book>/<chapter>.json`, last       | Check your understanding                  |

Every chapter has the same units in the same order, as the docs' accessibility checklist asks
("Make Your Course Easy to Navigate"). A unit shows a camera icon in the outline when it has a
class clip; Open edX picks the icon from what is in the unit.

Students stay inside the course: the only links that lead out are YouTube videos. Every other
link in a note (scripture references, the website) is kept as plain text.

## Quizzes

Each quiz is a JSON file drafted from the chapter's note and reviewed by hand before it goes
live. `answer` is the index of the correct choice (choices are shuffled for the student);
`explain` is shown after the student answers and should be the note's own words; `ref` links
the verse. Change `status` to `reviewed` once checked. The course passes at 70%.

## Running Open edX locally on a Mac (Tutor)

1. **Install Docker Desktop** and, under Settings > Resources, give it at least 4 CPUs,
   8 GB of memory and 30 GB of disk. Start it.
2. **Install Tutor** in its own Python environment:
   ```
   python3 -m venv ~/tutor-venv
   source ~/tutor-venv/bin/activate
   pip install "tutor[full]"
   ```
3. **Launch it:** `tutor local launch`. Answer **No** to "Are you configuring a production
   platform?", keep the defaults for the rest. The first launch downloads several GB and takes
   15 to 30 minutes.
4. **Make an admin account:**
   `tutor local do createuser --staff --superuser admin you@example.com`
5. **Open it:** the student site is http://local.openedx.io and Studio (where courses are
   built) is http://studio.local.openedx.io. Sign in with the admin account.

## Importing the course

1. In Studio, choose **New course**: organization `CyberJudah`, course number `GENESIS`,
   run `2026`, name `Genesis`.
2. In the course, open **Tools > Import** and upload `dist/edx/genesis.tar.gz`.
3. Open **View live** to see it as a student would. Enroll the admin account to try the quiz.

Re-importing replaces the course content with the new build. Student progress on units that
still exist is kept.

Stop everything with `tutor local stop`; `tutor local start -d` brings it back.
