# The offline library

The King James Bible (1611 order, with the Apocrypha) and every class's study notes, for places with
no internet and devices with little power. `build.py` makes it from `data/`, and the "Offline
library" workflow publishes the newest build to the `offline-latest` release whenever notes merge.

| File | For | How to use it |
|---|---|---|
| `cyberjudah.zim` | Android, iPhone, Windows, Mac, Linux | Install the free **Kiwix** app, then open the file in it. Kiwix has search and works on old phones. |
| `cyberjudah-offline-html.zip` | Any browser, feature phones, SD cards | Unzip it and open `html/index.html`. The pages have no scripts and are small. |
| `cyberjudah-offline-text.zip` | The smallest devices | Plain text, one file per book, with the notes under each verse. |

## One hub for a whole camp

A Raspberry Pi (or an old laptop) can serve the library over its own Wi-Fi to every phone nearby,
with no internet, and runs from a small solar panel and battery.

1. Put Raspberry Pi OS Lite on the Pi's SD card, and copy `cyberjudah.zim` onto it.
2. Install the Kiwix server: `sudo apt install kiwix-tools`.
3. Serve the library: `kiwix-serve --port 80 /path/to/cyberjudah.zim` (make it a systemd service so
   it starts with the Pi).
4. Turn the Pi into a Wi-Fi hotspot (in Raspberry Pi OS: `nmcli device wifi hotspot ssid CyberJudah password <password>`).
5. Phones join the CyberJudah Wi-Fi and open `http://10.42.0.1` in any browser (the address
   nmcli gives the hotspot).

Without a Pi, any laptop can do the same with `kiwix-serve` and the laptop's own hotspot. To
update, copy the newest `cyberjudah.zim` over the old one and restart `kiwix-serve`.

## Building it yourself

```
pip install libzim
python3 scripts/offline/build.py            # writes dist/offline/
```

Without `libzim` the web pages and text are still built; only the Kiwix file is skipped.
