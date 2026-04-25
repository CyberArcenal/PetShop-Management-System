# 🐾 PetShop Management System - Backend

A modular, scalable REST API backend for a pet shop management system built with **Express.js**, **Node.js**, and **TypeORM**.  
Designed as a modular monolith – easy to maintain, extend, and deploy – using pure JavaScript (CommonJS) for simplicity and reliability.

---

## ✨ Features

- 🐕 **Client Management** – CRUD for pet owners (name, email, phone, address)
- 🐈 **Product Management** – pets, food, accessories with stock tracking
- 📅 **Appointments** – grooming and vet visits (scheduling, status)
- 💰 **Sales & Invoicing** – transactions and billing
- 🔐 **Authentication** (coming soon) – JWT with role‑based access
- 📦 **Modular Monolith Architecture** – clean separation of concerns

---

## 🛠️ Tech Stack

| Layer          | Technology                                      |
|----------------|-------------------------------------------------|
| Runtime        | Node.js                                         |
| Framework      | Express.js                                      |
| Language       | JavaScript (CommonJS)                           |
| ORM            | TypeORM (with EntitySchema, no decorators)     |
| Database       | SQLite (dev) / PostgreSQL (production ready)   |
| Validation     | (optional) Joi / express-validator             |
| Auth           | JWT + bcrypt (planned)                         |
| Dev Tools      | nodemon                                         |
| API Docs       | Swagger / OpenAPI (swagger-jsdoc + swagger-ui) |

---

## 📁 Project Structure (Modular Monolith)

```
PETSHOP-MANAGEMENT-SYSTEM/
src/
├── common/
│   └── eventEmitter.js
├── config/
├── db/
├── middlewares/
├── modules/
│   ├── clients/
│   │   ├── entities/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   └── shared/
├── routes/
├── seeders/
├── subscribers/
│   └── client.subscriber.js
├── app.js
├── .env
├── package.json
├── petshop.sqlite (auto‑generated)
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- SQLite (included, no extra installation)

### Installation

1. **Clone the repository**  
   ```bash
   git clone https://github.com/CyberArcenal/PETSHOP-MANAGEMENT-SYSTEM.git
   cd PETSHOP-MANAGEMENT-SYSTEM
   ```

2. **Install dependencies**  
   ```bash
   npm install
   ```

3. **Set up environment variables** – create `.env` file  
   ```env
   PORT=3000
   NODE_ENV=development
   # optional: for future PostgreSQL
   # DB_HOST=localhost
   # DB_PORT=5432
   # DB_USERNAME=postgres
   # DB_PASSWORD=postgres
   # DB_DATABASE=petshop
   ```

4. **Run the development server**  
   ```bash
   npm run dev
   ```
   – The database file `petshop.sqlite` will be created automatically (TypeORM synchronize = true).  
   – Server starts at `http://localhost:3000`

---

## 📡 API Endpoints (v1)

Base URL: `http://localhost:3000/api/v1`

### Clients

| Method | Endpoint           | Description              |
|--------|--------------------|--------------------------|
| GET    | `/clients`         | Get all clients          |
| GET    | `/clients/:id`     | Get a client by ID       |
| POST   | `/clients`         | Create a new client      |
| PUT    | `/clients/:id`     | Update a client          |
| DELETE | `/clients/:id`     | Soft delete a client     |

#### Sample Request (POST /clients)

```json
{
  "name": "Juan Dela Cruz",
  "email": "juan@example.com",
  "phone": "09171234567",
  "address": "Manila"
}
```

#### Sample Response (200 OK)

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Juan Dela Cruz",
    "email": "juan@example.com",
    "phone": "09171234567",
    "address": "Manila",
    "createdAt": "2025-04-25T...",
    "updatedAt": "2025-04-25T...",
    "isDeleted": false
  }
}
```

---

## 📚 API Documentation (Swagger)

Once the server is running, open your browser at:  
👉 **http://localhost:3000/api-docs**

You will see the interactive Swagger UI where you can explore and test all endpoints.

---

## 🧪 Testing

Use **Postman**, **Insomnia**, or the **REST Client** extension in VS Code.

Example REST Client script (`test.http`):

```http
### Get all clients
GET http://localhost:3000/api/v1/clients

### Create a client
POST http://localhost:3000/api/v1/clients
Content-Type: application/json

{
  "name": "Maria Santos",
  "email": "maria@example.com",
  "phone": "09181234567",
  "address": "Quezon City"
}
```

---

## 📦 Future Modules

- **Products** – CRUD for pet products (food, toys, medicine) with stock management
- **Appointments** – grooming and vet appointments (client, pet, datetime, status)
- **Sales** – invoices, items, totals, and payment tracking
- **Authentication** – JWT login/register with roles (Admin, Staff)
- **Dashboard stats** – summary of clients, appointments, revenue

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **GNU General Public License v3.0** – see the [LICENSE](LICENSE) file for details.

---

## 📬 Contact

**CyberArcenal** – [cyberarcenal1@gmail.com](mailto:cyberarcenal1@gmail.com)  
Project Link: [https://github.com/CyberArcenal/PETSHOP-MANAGEMENT-SYSTEM](https://github.com/CyberArcenal/PETSHOP-MANAGEMENT-SYSTEM)

---

**Built with 🐾 for pet shop owners and developers.**