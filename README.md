# 🔐 FaceAuth Pro

FaceAuth Pro is a responsive, client-side face recognition web application built using **face-api.js**. It runs entirely in the browser without requiring any backend, ensuring fast performance and secure local data handling.

---

## 📌 Overview

FaceAuth Pro enables users to detect, recognize, and manage faces in real time using a webcam or static images. All data is stored locally in the browser, making it lightweight, fast, and privacy-friendly.

---

## 🚀 Features

- Real-time face detection using webcam  
- Face recognition from uploaded images  
- Add, rename, and delete face profiles  
- Sidebar interface for managing users  
- Local storage support (no backend required)  
- Responsive and user-friendly UI  

---

## 🛠 Tech Stack

- **Frontend:** HTML, CSS, JavaScript  
- **Library:** face-api.js  
- **Storage:** Browser LocalStorage  

---

## 📂 Project Structure

```
.
├── index.html     # Main UI and layout
├── script.js      # Face recognition logic
├── style.css      # Styling and UI design
```

---

## ⚙️ How It Works

1. The application uses **face-api.js** to detect faces in real time.  
2. Users can register faces using webcam or images.  
3. Facial data is stored in **LocalStorage**.  
4. The system matches detected faces with stored profiles.  

---

## ▶️ How to Run

1. Clone the repository:

```
git clone https://github.com/samfinrimal/Face-Recognition-System.git
cd Face-Recognition-System
```

2. Open `index.html` in your browser.

> ⚠️ Make sure you allow camera permissions for real-time detection.

---

## 📈 Future Improvements

- Add backend support for persistent storage  
- Improve recognition accuracy with model tuning  
- Add authentication system for user login  
- Deploy as a web application  

---

## 📄 License

This project is open-source and available under the MIT License.
