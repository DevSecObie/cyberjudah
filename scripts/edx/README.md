# Open edX courses from the study notes

`build_course.py` turns the 4 Chapters a Day notes in `docs/study/` into an Open edX course
that Studio can import. The notes stay the source: fix a note, rebuild, re-import.

```
python3 scripts/edx/build_course.py genesis --chapters 1     # the pilot: Genesis 1
python3 scripts/edx/build_course.py genesis --chapters 1-4   # the first reading session
python3 scripts/edx/build_course.py genesis                  # every chapter with a note
```

It writes `dist/edx/<book>.tar.gz` and needs nothing but Python 3.9+.

## How a book becomes a course

| Open edX      | From the notes                              | Example                                   |
|---------------|---------------------------------------------|-------------------------------------------|
| Course        | one book                                    | Genesis                                   |
| Section       | one reading session of four chapters        | Reading 1: Genesis 1-4                    |
| Subsection    | one chapter                                 | Genesis 1: The Creation of Light and Mankind |
| Unit          | the introduction, then each verse block     | Genesis 1:1-2                             |
| Graded quiz   | `quizzes/<book>/<chapter>.json`, if present | Genesis 1: Check your understanding       |

Every scripture link points back to cyberjudah.io, so a student can open the full chapter,
the precepts and the classes from any lesson.

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
