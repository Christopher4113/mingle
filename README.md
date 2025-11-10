
# Mingle

Mingle is an AI-powered social app that helps you find and connect with the right people at events based on your interests and vibe.


## Authors

- [@Christopher4113](https://www.github.com/Christopher4113)


## Demo

- [@Demo](https://vimeo.com/1135237610?share=copy&fl=sv&fe=ci)


## Features

- Smart AI Matching: Uses Gemini + Pinecone vector search to recommend people based on shared interests, bios, and social vibes.
- Event-Driven Socializing: Lets users create, join, and discover local events to meet new people around shared goals or activities.
- Seamless Profiles: Google login, bios, and optional social-media links that only appear once two users connect.
- Modern Stack & Experience: Built with Next.js, Prisma + Postgres, EdgeStore for images, and a clean, scrollable interface for real-time networking.


## Installation

Install mingle with npm

```bash
  cd client
  npm install
  cd server
  pip install -r requirements.txt
```
    
## Environment Variables

To run this project, you will need to add the following environment variables to your .env file

Frontend:

`DATABASE_URL`

`TOKEN_SECRET`

`NEXTAUTH_SECRET`

`NEXTAUTH_URL`

`GOOGLE_CLIENT_ID`

`GOOGLE_CLIENT_SECRET`

`EDGE_STORE_ACCESS_KEY`

`EDGE_STORE_SECRET_KEY`

`NEXT_PUBLIC_APP_URL`

`SMTP_USER`

`SMTP_PASS`

`FASTAPI_URL`

Backend:

`GOOGLE_API_KEY`

`TOKEN_SECRET`

`ALGORITHM`

`PINECONE_API_KEY`

`PINECONE_INDEX_NAME`

`NEXT_PUBLIC_APP_URL`
## Run Locally

Clone the project

```bash
  git clone https://github.com/Christopher4113/mingle
```

Go to the project directory

```bash
  cd client
```

```bash
  cd server
```

Install dependencies

```bash
  npm install
```

```bash
  pip install -r requirements.txt
```

Start the server

```bash
  npm run dev
```

```bash
  uvicorn main:app --reload  
```

## Contributing

Contributions are always welcome!

See `contributing.md` for ways to get started.

Please adhere to this project's `code of conduct`.


## Support

For support or feedback, email ch.lam1328@gmail.com.

