# Chat NestJS

## Installation

```bash
cd backend
npm install

cd ../frontend
npm install
```

## Configuration

Backend `.env`:
```
PORT=3000
JWT_SECRET=SECRET_KEY
DATABASE_PATH=chat.db
```

Frontend `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Lancement

Backend:
```bash
cd backend
npm run start:dev
```

Frontend:
```bash
cd frontend
npm run dev
```
