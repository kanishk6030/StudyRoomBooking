const mongoose = require("mongoose");

const Schema = mongoose.Schema;
const bookingSchema = new Schema({
    user:{
        type:Schema.Types.ObjectId,
        ref:"User",
    },
    room:{
        type:Schema.Types.ObjectId,
        ref:"Room",
        required:true,
    },
    date:{
        type: String, 
        required: true 
    },
    startTime:{
        type: String,
        required: true 
    },
    endTime:{
        type: String, 
        required: true 
    },
    checkedIn:{
        type:Boolean,
        default:false,
    },
    createdAt:{
        type: Date, 
        default: Date.now ,
    },
})

module.exports = new mongoose.model("Booking" , bookingSchema);