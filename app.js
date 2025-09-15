if(process.env.NODE_ENV != "production"){
  require('dotenv').config();
}
const PORT = process.env.PORT;

const express = require('express');
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const mongoose = require("mongoose");

const session = require("express-session");
const MongoStore = require('connect-mongo');
const passport = require("passport");
const LocalStrategy = require("passport-local");

const nodemailer = require("nodemailer");
const QRCode = require('qrcode');

const flash = require("connect-flash");
const User = require("./models/users.js");
const Room = require("./models/room.js");
const Booking = require("./models/booking.js");
const upload = require("./middlewares/multer.js");
const cloudinary = require("./utils/cloudConfig");

const app = express();
const path = require("path");

app.set("view engine","ejs");
app.set("views" , path.join(__dirname,"views"));
app.use(express.static(path.join(__dirname,"/public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);

const dbURL = process.env.ATLASDB_URL;
//MongoDB
main()
  .then(() => {
    console.log("Connected Successfully");
  })
  .catch((err) => {
    console.log(err);
  });
async function main() {
  await mongoose.connect(dbURL);
}

const store = MongoStore.create({
  mongoUrl : dbURL,
  crypto:{
    secret:process.env.SECRET,
  },
  touchAfter : 24 * 3600,
})

const sessionOptions = {
  store,
   secret:process.env.SECRET,
  resave:false,
  saveUninitialized : true,
  cookie:{
    expiry:Date.now + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly : true,
  }
}

app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req,res,next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  next();
});



function sendConfirmation(booking,userEmail,qrCodeDataUrl){

  const transporter = nodemailer.createTransport({
    service:"Gmail",
   auth:{
      user:process.env.EMAIL_USER,
      pass:process.env.EMAILPASS,
    }
  })

  if (!qrCodeDataUrl) {
    console.error("QR code data URL is missing!");
    return;
  }

  const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, "");
  const qrImageBuffer = Buffer.from(base64Data, "base64");


  const mailOptions = {
      from: process.env.EMAIL,
      to: userEmail, // Email from booking
      subject: 'Booking Confirmation',
      html: `
      <h1>Your Room Booking is Confirmed!</h1>
      <p>Room: ${booking.room.name}</p>
      <p>Date: ${booking.date}</p>
      <p>Time: ${booking.startTime} - ${booking.endTime}</p>
      <p>Please present this QR code at the room entrance for check-in:</p>
      <img src="cid:qrcode_cid" alt="QR Code" />
    `,
    attachments: [
      {
        filename: "qrcode.png",
        content: qrImageBuffer,
        cid: "qrcode_cid" // same as in the img src above
      }
    ]
    }
    
    transporter.sendMail(mailOptions).then(info => 
      console.log('Confirmation email sent:', info.response))
    .catch(err => console.error('Error sending email:', err));
}

async function generateQRCode(bookingId) {
  const checkInUrl = `https://studyroombooking.onrender.com/checkin/${bookingId}`;
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(checkInUrl);
    return qrCodeDataUrl; // This is a Base64 image URL you can embed
  } catch (err) {
    console.error(err);
  }
}

function isAdmin (req,res,next){
  if(req.isAuthenticated() && req.user.role === "admin"){
    return next();
  }
}

function isUser (req,res,next){
  if(req.isAuthenticated() && req.user.role === "user"){
    return next();
  }
}

app.get("/login",(req,res)=>{
  res.render("./users/login.ejs")
})

app.get("/signup",(req,res)=>{
  res.render("./users/signup.ejs")
})


app.post("/signup",async(req,res)=>{
  try{
  const { username , email , password , role } = req.body;
  let newUser =  new User( {
    email:email,
    username:username,
    role:role,
  });
  const registeredUser = await User.register(newUser, password);
  console.log(registeredUser);

  req.flash("success","Signed Up Successfully");
  return res.redirect("/login");
}catch(err){
  req.flash("error" , "Some error occured");
  console.log(err);
}

})

app.post("/login",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureMessage:true,
  }),
  (req, res) => {
    try{
    console.log("logged in as ", req.user);
    if(req.user.role === "user"){
      req.flash("success","Your are logged in successfully as USER");
      return res.redirect("/")
    }
    if(req.user.role === "admin"){
      req.flash("success","Your are logged in successfully as ADMIN");
      return res.redirect("/admin");
    }
  }catch(err){
    req.flash("error","Not Logged In");
    console.log(err);
  }
  }
);

app.get("/logout",(req,res)=>{
  req.logout((err)=>{
    if(err){
      console.log(err);
    }
  })
  req.flash("success","Logged Out Successfully");
  res.redirect("/login");
})

app.get("/" , async(req,res)=>{
    const rooms = await Room.find();
    res.render("./rooms/dashboard.ejs",{ rooms });
})

app.get("/book", async(req, res) => {
  if (!req.isAuthenticated()) {
      return res.redirect("/login");
    }
  try {
    const rooms = await Room.find();
    res.render("./rooms/booking.ejs", { rooms });
  } catch (err) {
    req.flash("error","Internal Server Error");
    console.error("Error fetching rooms:", err.message);
  }
});

app.post("/book",async(req,res)=>{
  const { roomId, date, stTime,endTime } = req.body;
  console.log(roomId);

  try{
    // Checking for the already booked rooms
    const already_booked = await Booking.findOne({
      room: roomId,
      date,
       startTime: { $lt: endTime },
       endTime: { $gt: stTime }
    });

    console.log("Already Booked:" , already_booked);
    if(already_booked){
      return res.status(400).send( "Room already booked for this time." );
    }
 
    
  const room = await Room.findById(roomId);
  if(!room){
    return res.status(400).send("No Such Rooms");
  }

  if(room.capacity <= 0){
    return res.send("Room is fully booked. No such spaces left");
  }
//Date Check
 if (new Date(req.body.date).toISOString().slice(0, 10) !== new Date(room.date).toISOString().slice(0, 10)) {
  req.flash("error","Select the available date.");
  return res.redirect("/book")
}


    const userEmail = req.user.email;

    const booked_room = new Booking({
      user:req.user._id,
      room: req.body.roomId ,
      date: req.body.date,
      startTime: req.body.stTime,
      endTime: req.body.endTime,
    })
    const savedBooking = await booked_room.save();
    console.log("Booking saved:", savedBooking);

    room.capacity = room.capacity - 1;
    await room.save();

    const qrCodeDataUrl = await generateQRCode(savedBooking._id);

    sendConfirmation(savedBooking,userEmail,qrCodeDataUrl);

    req.flash("success", "Booking done. Check your mail.")
    return res.redirect("/book");
  }
  catch (err) {
    req.flash("error","Internal Server Error");
    console.error("Error fetching rooms:", err.message);
  }
})

app.get("/checkin/:bookingId", async (req, res) => {
  const { bookingId } = req.params;

  try {
    const booking = await Booking.findById(bookingId).populate("room user");
    if (!booking) {
      return res.status(404).send("Invalid QR code / Booking not found!");
    }

    if (booking.checkedIn) {
      return res.send("Already checked in.");
    }

    booking.checkedIn = true;
    await booking.save();

    req.flash("success","You have checked in successfully")
    res.send(`
      <h1>Check-In Successful!</h1>
      <p>User: ${booking.user.username}</p>
      <p>Room: ${booking.room.name}</p>
      <p>Date: ${booking.date}</p>
    `);
  } catch (err) {
    req.flash("error","Internal Server Error");
    console.error("Error during check-in:", err.message);
  }
});

app.get("/search",async(req,res)=>{
  const {selected_date} = req.query;
  const selected_rooms = await Room.find({date:selected_date});
  res.render("./rooms/dashboard_search.ejs",{ selected_rooms , selected_date });
})

//My bookings
app.get("/book/my", async (req, res) => {
  if (!req.isAuthenticated()) {
      return res.redirect("/login");
    }
  try {
    const bookings = await Booking.find({ user:req.user._id }).populate("room");  
    console.log(req.user);
    if(bookings.length === 0){
      console.log("Not available");
    }
    res.render("./rooms/mybooking.ejs", { bookings });
  } catch (err) {
    console.error("Error fetching bookings:", err.message);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/book/my/edit/:bookingId/:roomId",async(req,res)=>{
  const { bookingId , roomId } = req.params;
  const room = await Room.findById(roomId);
  const booking = await Booking.findById(bookingId);
  res.render("./rooms/mybooking_edit.ejs",{ booking , room });
})

app.put("/book/my/edit/:bookingId",async(req,res)=>{
  const { date,stTime,endTime } = req.body;
  const { bookingId } = req.params;
  const updatedBooking = await Booking.findByIdAndUpdate(bookingId,{
    date: date,
    startTime : stTime,
    endTime : endTime,
  })
  console.log("Updatedd succesfully" , updatedBooking);
  const user = await User.findById(updatedBooking.user);
  const userEmail = user.email;
  const qrCodeDataUrl = await generateQRCode(updatedBooking._id);
  sendConfirmation(savedBooking,userEmail,qrCodeDataUrl);
  req.flash("success","Updated your booking, Check your mail ");
  res.redirect('/book/my');
})

app.delete("/book/my/:bookingId",async(req,res)=>{
  const { bookingId } = req.params;
  const deletedBooking = await Booking.findByIdAndDelete(bookingId);
  console.log(deletedBooking);
  req.flash("error"," Booking deleted ");
  res.redirect("/book/my");
})

app.get("/admin",isAdmin,(req,res)=>{
  res.render("./admin/a_dashboard.ejs")
})

app.get("/admin/room",(req,res)=>{
  res.render("./admin/addrooms.ejs");
})

app.post("/admin/room",upload.single("room_image"),async(req,res)=>{
try {
  console.log(req.body);
    const { room_name , room_capacity ,room_date} = req.body;

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "rooms", // optional folder
    });

    const room1 = new Room({
    name:room_name,
    capacity:room_capacity,
    date:room_date,
    imageUrl: result.secure_url,
    });

    const savedroom = await room1.save();
    console.log(savedroom);

    req.flash("success","Room added successfully")
    return res.redirect("/admin/room");
} catch (error) {
  console.log(error);
    req.flash("error","Failed to add room");
    return res.redirect("/admin/room")
}
})

app.get("/admin/user",async(req,res)=>{
  const users = await User.find();
  res.render("./admin/manage_users.ejs",{users});
})

app.delete("/admin/user/delete/:userId",async(req,res)=>{
  const { userId } = req.params;
  const deletedBookings = await Booking.deleteMany({user:userId})
  const deletedUser = await User.findByIdAndDelete(userId);
  console.log(deletedUser,deletedBookings);
  req.flash("error"," User deleted ");
  res.redirect("/admin/user");
})

app.get("/admin/room/manage",async(req,res)=>{
  const rooms = await Room.find();
  res.render("./admin/manage_rooms.ejs",{rooms});
})

app.delete("/admin/room/manage/delete/:roomId",async(req,res)=>{
  const { roomId } = req.params;
  const deletedBookings = await Booking.deleteMany({room:roomId})
  const deletedRoom = await Room.findByIdAndDelete(roomId);
  console.log(deletedRoom , deletedBookings);
  req.flash("error"," Room deleted ");
  res.redirect("/admin/room/manage");
})

app.listen(PORT , ()=>{
    console.log(`listening to server with the PORT = ${PORT}`)
})
