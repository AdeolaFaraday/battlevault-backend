# Skillslet

## Overview

This project is a gaming platform where users can play games like Ludo and Chess etc. against each other, staking real money. The winner takes the stake from the opponent. The backend is developed using Node.js, Express.js, TypeScript, and GraphQL.

## Table of Contents

- Features

- Technologies Used

- Installation

- Environment Variables

- Scripts

- GraphQL Endpoints

- Folder Structure



## Features

- User authentication and authorization (JWT-based).

- Real-time matchmaking using WebSockets.

- Staking system for games.

- Secure transactions and game data management.

- GraphQL API for flexible querying and mutations.

- Error handling and input validation.

- Type-safe backend development using TypeScript.

- Technologies Used

- Node.js: JavaScript runtime for server-side applications.

- Express.js: Fast and minimalist web framework.

- TypeScript: Type-safe programming.

- GraphQL: API query language and runtime.

- WebSocket: For real-time updates and gameplay.

- MongoDB: Database for storing user and game data.

- Redis: For caching and managing WebSocket sessions.

- Stripe: For handling monetary transactions (or any payment gateway of your choice).

## Installation

`Prerequisites`

- Node.js **(v18 or later)**

- npm or yarn

- MongoDB (local or cloud instance)

- Redis server

## Steps

Clone the repository:

git clone https://github.com/AdeolaFaraday/battlevault-backend.git

Navigate to the project directory:

cd battlevault-backend

## Install dependencies:

npm install
# or
yarn install

Create a .env file in the root directory and configure the required environment variables (see Environment Variables).

Start the development server:

npm run dev
# or
yarn dev

## Environment Variables

Create a .env file in the root directory and include the following:

- PORT=4000
- DB_CLOUD_CONNECTION=your-mongodb-connection-string
- REDIS_URL=your-redis-url
- JWT_SECRET=your-jwt-secret
- STRIPE_SECRET_KEY=your-stripe-secret-key
- NODE_ENV=development

## Scripts

npm run dev: Start the development server.

npm run build: Build the project for production.

npm run start: Start the production server.

npm run lint: Run linter to check code quality.

npm run test: Run test cases (if implemented).

GraphQL Endpoints

Examples

Authentication

Login

mutation LoginUser($email: String, $password: String) {
  login(email: $email, password: $password) {
    id
    email
  }
}

## Folder Structure

<!-- `root` -->
`├── src                                    `
`│   ├── config         # Configuration files`        
`│   ├── controllers    # Route controllers`   
`│   ├── graphql        # GraphQL schema and resolvers`       
`│   ├── middlewares    # Express middlewares`   
`│   ├── models         # MongoDB models`        
`│   ├── services       # Business logic`      
`|   ├── startup        # Db service initialization`       
`│   ├── utils          # Utility functions`        
`│   └── app.ts         # Entry point`        
`├── tests              # Unit and integration tests`             
`├── .env.example       # Sample environment variables`      
`├── tsconfig.json      # TypeScript configuration`     
`└── package.json       # Project metadata and scripts`      