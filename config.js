const firebaseConfig = {
  apiKey: "AIzaSyC_w3RgcN2CDgbEgEYgeqwh6aSSExcAusQ",
  authDomain: "budget-management-system-cf90e.firebaseapp.com",
  projectId: "budget-management-system-cf90e",
  storageBucket: "budget-management-system-cf90e.firebasestorage.app",
  messagingSenderId: "1050900986685",
  appId: "1:1050900986685:web:3bda535b027dbed71d2354"
};

if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    var db = firebase.firestore();
    var auth = firebase.auth();
    var storage = firebase.storage();
    var currentUser = null; 
    var currentYear = new Date().getFullYear() + 543;
    console.log("Firebase Connected OK");
} else {
    alert("Firebase Error: Libraries not loaded");
}