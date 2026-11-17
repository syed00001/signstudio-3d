# SignStudio 3D

SignStudio 3D is a browser-based interactive American Sign Language learning app. It combines a sign library, reference videos, a 3D articulated hand viewer, and a live camera testing flow to help students practice and validate signs in context.

## Features

- Sign library with alphabet, number, and phrase categories
- Video-based learning lessons for each sign
- Interactive 3D hand visualization
- Live camera-based sign testing workflow
- Admin studio mode for managing curriculum content
- Local browser persistence for learner progress and mastery tracking

## Project structure

- `index.html` — main application entry point
- `css/` — styles and layout
- `js/` — application logic, data, and viewer modules
- `models/` — 3D assets
- `videos/` — learning and demonstration videos

## Run locally

Because the project uses browser modules and external imports, it is best served through a local web server.

### Option 1: Python

```bash
cd "C:\Users\91968\Desktop\new app try"
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

### Option 2: Any static server

Serve the project folder with any local static file server of your choice.

## Notes

- Default admin passcode: `admin123`
- The app stores learner state in browser local storage
- Media assets are included in the `videos/` and `models/` folders

## License

This project is provided as-is for educational and demo purposes.
