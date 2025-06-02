const mongoose = require("mongoose");

const Schema = mongoose.Schema;
const roomSchema = new Schema({
    name:{
        type: String, 
        required: true, 
        unique: true
    },
    capacity:{
        type: Number,
        required: true
    },
    date:{
        type:Date,
        default:Date.now(),
    }
})

const Room = new mongoose.model("Room" , roomSchema);

module.exports = Room;
// const room = new mongoose.model("Room" , roomSchema);

// const room1 = new room({
//     name:"Room A - Silent Zone",
//     capacity:8,
// });

// room1.save().then((res)=>{
//     console.log(res);
// });
