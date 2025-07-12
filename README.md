# 📚 Study Room Booking System

A full-stack web application that allows users to book available study rooms by selecting specific time slots. Admins manage room listings, and users receive a booking confirmation email with a scannable QR code for verification at the booking location.

---

## 🚀 Features

- 🧑‍💼 **Admin Panel**: Admins can add or manage study rooms.
- 🗓️ **Slot Booking**: Users can view and book available time slots for different rooms.
- 📧 **Email Confirmation**: After booking, users receive a confirmation email.
- 📱 **QR Code Generation**: A unique QR code is sent in the email and can be scanned at the venue for validation.
- 🔒 **Authentication** *(Optional)*: Secure login system for users and admins.

---

## 🛠️ Tech Stack

- **Frontend**: HTML/CSS/JS  (no framework used)
- **Backend**: Node.js, Express.js
- **Database**: MongoDB (hosted on MongoDB Atlas)
- **Email Service**: Nodemailer
- **QR Code Generation**: `qrcode` npm package

---

## 📁 Environment Variables

Create a `.env` file in your root directory and configure it as shown below:

```env
# MongoDB Atlas connection string
ATLASDB_URL=your_mongodb_atlas_connection_string

# Email credentials (used by Nodemailer)
EMAIL_USER=your_email@example.com
EMAILPASS=your_email_password_or_app_password

# App port
PORT=8000

# Secret key for tokens/sessions
SECRET=your_jwt_or_session_secret
