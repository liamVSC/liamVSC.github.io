// Replace with your own Firebase config object
const firebaseConfig = {
  apiKey: "AIzaSyDikCMGWLIPytpP59lAxVeHOF2Z_0RmtLY",
  authDomain: "liamvsc.firebaseapp.com",
  projectId: "liamvsc",
  storageBucket: "liamvsc.firebasestorage.app",
  messagingSenderId: "748359707687",
  appId: "1:748359707687:web:306ec41c292319887fb202",
  measurementId: "G-VDHY5SG8PP"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
