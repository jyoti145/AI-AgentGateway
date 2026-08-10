import jwt from "jsonwebtoken";

export const signAccessToken = (agent)=>{
    return jwt.sign(
        { id: agent._id , role: agent.role },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
    )
}       
    
export const signRefreshToken = (agent) =>{
    return jwt.sign(
        { id: agent._id},
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
    )
}