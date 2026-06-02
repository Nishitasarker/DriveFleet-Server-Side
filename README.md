# DriveFleet (Server-Side)

DriveFleet is a robust, secure, and scalable backend REST API designed for a premium car rental and fleet management platform. Built using **Node.js**, **Express.js**, and **MongoDB**, it manages vehicle inventories, processes multi-instance bookings, ensures data integrity via atomic database counters, and secures routes using advanced JSON Web Token (JWT) verification powered by remote JWKS.

## 🚀 Live Links & Repositories

- **Client-Side Repository:** [GitHub Link](https://github.com/Nishitasarker/DriveFleet)
- **Server-Side Repository:** [GitHub Link](https://github.com/Nishitasarker/DriveFleet-Server-Side)

---

## ✨ Features

- **JWT Authentication via Jose:** Secure route protection using remote JSON Web Key Sets (JWKS) to verify distributed session tokens.
- **Dynamic Inventory Management:** Full CRUD operations for vehicle entries tied specifically to verified owners.
- **Advanced Query Filtering:** Built-in server-side regex searching for vehicle names and categorical filtering for car types.
- **Multi-Instance Booking Support:** Allows users to book the same vehicle multiple times seamlessly without restrictive duplication blockers.
- **Atomic Booking Counters:** Utilizes MongoDB's `$inc` operator to update vehicle metrics (`bookingCount`) in real-time upon successful checkouts.
- **Cross-Origin Resource Sharing (CORS):** Configurations tailored for seamless, credential-enabled cookie/token communication with Next.js frontends.

---

## 🛠️ Tech Stack & Dependencies

- **Runtime Environment:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB (Native Driver)
- **Security & Tokens:** Jose (JSON Web Signing and Verification)
- **Environment Management:** Dotenv
- **Cross-Origin Handling:** Cors

---

## 📋 API Architecture & Route Details

### 🔒 Authentication Middleware
`verifyToken`: Extracts the asymmetric token from the `Authorization: Bearer <token>` header and validates it against the remote JWKS identity provider endpoint. Attaches the verified payload into `req.user`.

---

### 🚗 Vehicle (`destination`) Routes

#### 1. Get All Vehicles (With Filters)
- **Endpoint:** `GET /destination`
- **Access:** Public
- **Query Parameters:** - `search` (Optional): Filters vehicle names matching a case-insensitive regular expression.
  - `carType` (Optional): Filters by vehicle categorization (e.g., SUV, Sedan, Luxury).
- **Description:** Fetches all available entries in the showroom according to search/filter criteria.

#### 2. Get Authenticated User's Vehicles
- **Endpoint:** `GET /my-cars`
- **Access:** Private (Requires Valid Token)
- **Description:** Retrieves an array of all vehicles added exclusively by the logged-in user matching their token email (`ownerEmail`).

#### 3. Get Single Vehicle Details
- **Endpoint:** `GET /destination/:id`
- **Access:** Private (Requires Valid Token)
- **Description:** Fetches complete object details for a specific vehicle based on its MongoDB `ObjectId`.

#### 4. Add a New Vehicle
- **Endpoint:** `POST /destination`
- **Access:** Private (Requires Valid Token)
- **Payload Schema:**
  ```json
  {
    "carName": "Tesla Model S",
    "dailyPrice": 120,
    "carType": "Electric / Luxury",
    "seatCapacity": 5,
    "imageUrl": "[https://example.com/car.jpg](https://example.com/car.jpg)",
    "pickupLocation": "San Francisco, CA",
    "availability": "Available",
    "description": "Premium electric sedan experience."
  }

#### 5. Description: Registers a new vehicle into the platform database, auto-binding the logged-in user's email as the ownerEmail and initializing bookingCount: 0.

#### 6. Update Vehicle Information
1. Endpoint: PUT /cars/:id

2. Access: Private (Requires Valid Token + Record Ownership)

3. Description: Modifies field parameters (dailyPrice, description, availability, etc.) for an existing record. Validates that the requesting user's token matches the record's ownerEmail.

#### 7. Delete a Vehicle
1. Endpoint: DELETE /cars/:id

2. Access: Private (Requires Valid Token + Record Ownership)

3. Description: Permanently deletes a vehicle entry. Restricts actions to the verified listing owner.

📅 Booking Routes
#### 8. Get User Bookings
1. Endpoint: GET /booking/:email

2. Access: Private (Requires Valid Token)

3. Description: Retrieves all historical and active reservation slips processed by a specific user email using a case-insensitive query mechanism.

#### 9. Create a New Booking
1. Endpoint: POST /booking

2. Access: Private (Requires Valid Token)

3. Payload Schema:

JSON
{
  "userId": "usr_982374",
  "userEmail": "user@example.com",
  "carId": "65cbde3...",
  "carName": "Tesla Model S",
  "carImage": "[https://example.com/car.jpg](https://example.com/car.jpg)",
  "carPrice": 120,
  "carType": "Electric / Luxury",
  "driverNeeded": "Yes",
  "specialNote": "Please arrange a child safety seat.",
  "bookedAt": "2026-06-02T05:30:00.000Z"
}
4. Description: Appends a new reservation item directly to the collection. It allows repetitive/duplicate bookings of the same vehicle and concurrently invokes an atomic $inc update to increments the targeted car's global bookingCount by 1.

#### 10. Cancel a Booking
1. Endpoint: DELETE /booking/:bookingId

2. Access: Private (Requires Valid Token)

3. Description: Deletes a targeted reservation slip based on its specific booking ID.

🛠️ Environment Setup & Installation
#### 11. Follow these steps to run the DriveFleet Server environment locally:

1. Clone the Repository:

Bash
git clone [https://github.com/Nishitasarker/DriveFleet-Server-Side.git](https://github.com/Nishitasarker/DriveFleet-Server-Side.git)
cd DriveFleet-Server-Side
Install Required Packages:

2. Bash
npm install

3. Configure Environment Variables:
Create a .env file in the root directory and append the following variables:

Code snippet
PORT=5000
MONGODB_URI=mongodb://DriveFleet:o82Ss1cRtfL2o7gb@ac-o35aqvy-shard-00-00.vmzudvv.mongodb.net:27017,ac-o35aqvy-shard-00-01.vmzudvv.mongodb.net:27017,ac-o35aqvy-shard-00-02.vmzudvv.mongodb.net:27017/?ssl=true&replicaSet=atlas-4fx8yo-shard-0&authSource=admin&appName=Cluster0

CLIENT_URL=http://localhost:3000


#### 12. Start the Development Server:

Bash
npm start
The backend should now be actively listening on http://localhost:5000.

👥 Contributors
Nishita Sarker Jui - Aspiring Frontend & Full-Stack Web Developer.