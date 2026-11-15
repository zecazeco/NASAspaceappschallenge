# Earth Jukebox

**NASA Space Apps Challenge 2026 · "The Earth Information Jukebox"**
**Earth Jukebox: 74 Years of Your City's Temperature Change, in Sound**

> **Hear your city's climate change from 1950 to today.**
> The sound you hear is the color NASA's map has over your city.

Live site: https://zecazeco.github.io/NASAspaceappschallenge/ (use headphones; on iPhone, turn off silent mode)

Earth Jukebox is a mobile-first web app that turns NASA's global temperature anomaly map into music. You pick a city by GPS or by typing its name, and hear 1950 to 2023 in about 2 minutes 40 seconds, one musical bar per year. Every year sounds different because every year has a different color on the map. It was designed with **blind and low-vision people in mind** and is open to everyone: you can hear and see it, and everything the map and the chart show can also be heard.

---

## What you are hearing

The **temperature anomaly** of your city: how much warmer or cooler each year was than the 1951–1980 average *of the same place*. In climate science, "anomaly" simply means a difference from a reference, which lets us compare very different cities (Manaus and Oslo can both be +1 °C above their own normal). Because it is a difference, +1 °C equals +1.8 °F (no +32).

The map is a 24-month moving average, so each year is a smoothed value, not a single day's thermometer reading.

## How it works

1. **Frames.** The site ships one image per year of NASA's *Global Temperature Anomalies, 1880 to 2023* visualization (SVS 5207, NASA GISS GISTEMP v4), prepared from NASA's own frames (`tools/preparar-frames-nasa.py`).
2. **Color to number, in your browser.** The city's latitude and longitude become a pixel on the Robinson-projected map. The site takes the median color of a 5×5 pixel window and matches it to the color legend printed inside the frame (−2 to +2 °C). If NASA swaps the images, the music changes with them. Reading the colors is accurate to about ±0.1 °C.
3. **A track for your city.** The values of all years decide which sound plays each year and which events (record years, droughts) get a card and an accent.
4. **Live mix.** Recorded loops and bars locked to 110 BPM in D minor are chosen and mixed live in the browser with Tone.js. The code only adjusts volume, never pitch or tempo, so any combination sounds like one piece. The sound is assembled in real time from the frame colors; it is not synthesized from scratch (the rain sounds are the one exception, see Limits).
5. **Context layers.** Carbon dioxide (NOAA, 1959–2023) and your city's rainfall (NASA POWER, from 1981) play alongside, so you can hear how they relate to the temperature.

## The sounds, in short

| Layer | Data | What you hear |
|---|---|---|
| Temperature melody (piano) | change to next year, from the map color | 7 one-bar figures: flat, small / medium / large rise, small / medium / large fall. Every figure starts and ends near D |
| Temperature level (piano) | the year's value, in fixed 1 °C bands | 4 loops (below −1, −1 to 0, 0 to +1, above +1 °C). Higher pitch = warmer |
| Carbon dioxide (low organ and strings) | NOAA Mauna Loa annual mean | 5 voices that stack up as concentration grows; a single low D closes the piece in 2023 |
| Rainfall (kalimba) | NASA POWER, change to next year | 4 loops from 2 to 5 notes: more rain rising = more notes. Extreme rain and drought have a short accent |

Short accents mark peaks and valleys of the temperature line and record-hot years.

## Accessibility

- Large buttons with text labels; full keyboard control (space plays or pauses, arrows move through the years).
- Screen readers: a live region announces the city, the year, events and the end of the piece; the temperature map has a text description with the year's value.
- Time travel works like **rewinding a tape**: the music itself plays backwards, with a tick for each year.
- High-contrast retrofuturist design aiming at WCAG AA, 48 px touch targets, and reduced-motion support.
- Opens in English and °F; Portuguese and °C are one tap away, and both units are shown side by side.
- Not yet tested with blind and low-vision listeners. That is the next step.

## Data and credits

| Layer | Source | How it reaches the site |
|---|---|---|
| Temperature | NASA Scientific Visualization Studio, *Global Temperature Anomalies, 1880 to 2023* (SVS 5207), NASA GISS GISTEMP v4 · https://svs.gsfc.nasa.gov/5207/ | read from the color of the frame over your city, in the browser |
| Rainfall | NASA POWER (MERRA-2 precipitation) · https://power.larc.nasa.gov | fetched live for your city's coordinates |
| CO₂ | NOAA Global Monitoring Laboratory, Mauna Loa, annual mean · https://gml.noaa.gov/ccgg/trends/ | bundled in `data/co2-noaa.json` |

NASA POWER acknowledgement: The data was obtained from National Aeronautics and Space Administration (NASA) Langley Research Center's Prediction Of Worldwide Energy Resources (POWER) project funded through the NASA Earth Science Division. Rainfall data accessed 2026/11/15 through the POWER monthly point API (https://power.larc.nasa.gov/api/temporal/monthly/point).

CO₂ citation requested by NOAA: Dr. Xin Lan, NOAA/GML (gml.noaa.gov/ccgg/trends/) and Dr. Ralph Keeling, Scripps Institution of Oceanography (scrippsco2.ucsd.edu/).

Also used: Open-Meteo Geocoding (city search; GeoNames data, CC BY 4.0), BigDataCloud (reverse geocoding of the GPS position), a small local list of cities (`data/cidades.json`, a fallback used only if the city search fails, created with AI assistance from the city-search API data), Tone.js 14.8.49 (MIT), d3 7.9.0 and d3-geo-projection 4.0.0 (ISC), and the fonts Atkinson Hyperlegible Next, Chakra Petch and IBM Plex Mono (SIL Open Font License). All music loops for the temperature and CO₂ layers were composed and recorded by a doctor of music on our team.

## Honest limits

- Only the temperature is read from NASA frames; CO₂ and rainfall come from data series and add context.
- The audio is built from recorded loops, not synthesized from scratch. The exception is the rain sounds, which are synthesized by a script (`tools/gerar-sons-provisorios.mjs`) written with AI assistance.
- If NASA POWER cannot be reached, the rainfall layer is switched off and the interface says so.
- The repository still carries 21 placeholder climate regions from the first prototype (`data/timeline.json`). While the map frames and NASA POWER work, their values are not used. The name of the region nearest to your city is announced to screen readers (in Portuguese), and the placeholder values are the fallback if the map manifest fails to load.

## Run it on your computer

```bash
python tools/servidor.py
```

Open http://localhost:8080. A server is required: opening `index.html` directly does not work. On a phone, GPS and audio need HTTPS when the address is not `localhost` (for example `npx localtunnel --port 8080`, or GitHub Pages).

To download NASA's maps again: `python -I tools/preparar-frames-nasa.py`.

### Folders

| Folder | What is in it |
|---|---|
| `index.html`, `css/`, `js/` | the site |
| `js/frames.js` | reads the map color over the city and turns it into a number |
| `js/trilha.js` | the music rules: which bar, level and accent plays each year |
| `js/audio/` | sound engine (Tone.js), layers and tape effect |
| `data/frames/` | the map of each year and `manifesto.json` (projection, crop and legend of each map) |
| `data/` | `co2-noaa.json`, `cidades.json`, `timeline.json` (list of years) |
| `audio/` | the sounds, by layer: `temperatura/`, `tendencia/`, `co2/`, `chuva/` |
| `tools/` | local server and scripts that prepare the frames and synthesize the rain sounds |

## Use of AI

The website code was developed with AI assistance (Claude, by Anthropic), directed by our team, who defined the concept, the musical mapping and the design decisions. The rain sounds were synthesized by a script written with AI assistance, the music loops were spliced with AI help, the fallback list of cities (`data/cidades.json`) was created with AI assistance, and part of the documentation was written with AI assistance. The piano and CO₂ loops were composed and recorded by a human musician on our team.

## License

The Space Apps terms require original content to be freely available or open source (OSI). The code and all original text and design are released under the **MIT License** (see `LICENSE`). The music loops for the temperature and CO₂ layers were composed and recorded by a member of our team, who agreed to release them for anyone to use freely: they are released under **CC0** (public domain dedication). Third-party materials keep their own licenses, listed above.
