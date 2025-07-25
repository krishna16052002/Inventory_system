# Assembly Parts Inventory Backend

This project implements a REST API for managing raw and assembled parts inventory for a manufacturing plant.

## Tech Stack
- Node.js
- TypeScript
- Express
- MongoDB (Mongoose)

## Setup

1. **Clone the repository**
2. **Run the server:**
   ```bash
   npx ts-node-dev src/app.ts
   ```

## API Endpoints

### Register a Part
`POST /api/part`
- Register a raw or assembled part.
- Example (raw):
  ```json
  { "name": "Bolt", "type": "RAW" }
  ```
- Example (assembled):
  ```json
  { "name": "Gearbox", "type": "ASSEMBLED", "parts": [ { "id": "bolt-1", "quantity": 4 } ] }
  ```

### Add Parts to Inventory
`POST /api/part/:partId`
- Add quantity to a part (raw or assembled).
- Example:
  ```json
  { "quantity": 10 }
  ```
- For assembled parts, constituent parts' stock is checked and deducted atomically.

## Features
- Prevents circular dependencies in assemblies
- Supports nested assemblies
- Atomic inventory updates using MongoDB transactions
- Input validation and error handling

