import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDikCMGWLIPytpP59lAxVeHOF2Z_0RmtLY",
  authDomain: "liamvsc.firebaseapp.com",
  projectId: "liamvsc",
  storageBucket: "liamvsc.firebasestorage.app",
  messagingSenderId: "748359707687",
  appId: "1:748359707687:web:306ec41c292319887fb202",
  measurementId: "G-VDHY5SG8PP"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
