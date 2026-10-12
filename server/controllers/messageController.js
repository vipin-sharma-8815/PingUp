import fs from "fs";
import imagekit from "../configs/imageKit.js";
import Message from "../models/Message.js";

// Store SSE connections
const connections = {};

// Controller function for SSE endpoint
export const sseController = (req, res) => {
    const { userId } = req.params;

    console.log("New client connected:", userId);

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Store client's response object
    connections[userId] = res;

    // Send initial event
    res.write("data: Connected to SSE stream\n\n");

    // Handle client disconnection
    req.on("close", () => {
        delete connections[userId];
        console.log("Client disconnected:", userId);
    });
};


// Send Message
export const sendMessage = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { to_user_id, text } = req.body;
        const image = req.file;

        let media_url = "";

        // Determine message type
        const message_type = image ? "image" : "text";

        // Upload image to ImageKit
        if (image) {
            const fileBuffer = fs.readFileSync(image.path);

            const response = await imagekit.upload({
                file: fileBuffer,
                fileName: image.originalname,
            });

            media_url = imagekit.url({
                path: response.filePath,
                transformation: [
                    { quality: "auto" },
                    { format: "webp" },
                    { width: "1280" }
                ]
            });
        }

        // Create message
        const message = await Message.create({
            from_user_id: userId,
            to_user_id,
            text,
            message_type,
            media_url
        });

        // Get message with sender information
        const messageWithUserData = await Message.findById(message._id)
            .populate("from_user_id");

        // Send message through SSE
        if (connections[to_user_id]) {
            connections[to_user_id].write(
                `data: ${JSON.stringify(messageWithUserData)}\n\n`
            );
        }

        // Send response to sender
        return res.json({
            success: true,
            message: messageWithUserData
        });

    } catch (error) {
        console.log(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// Get Chat Messages
export const getChatMessages = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { to_user_id } = req.body;

        const messages = await Message.find({
            $or: [
                {
                    from_user_id: userId,
                    to_user_id
                },
                {
                    from_user_id: to_user_id,
                    to_user_id: userId
                }
            ]
        }).sort({ createdAt: -1 });

        // Mark messages as seen
        await Message.updateMany(
            {
                from_user_id: to_user_id,
                to_user_id: userId
            },
            {
                seen: true
            }
        );

        return res.json({
            success: true,
            messages
        });

    } catch (error) {
        console.log(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// Get User Recent Messages
export const getUserRecentMessages = async (req, res) => {
    try {
        const { userId } = req.auth();

        const messages = await Message.find({
            $or: [
                {
                    from_user_id: userId
                },
                {
                    to_user_id: userId
                }
            ]
        })
            .populate("from_user_id to_user_id")
            .sort({ createdAt: -1 });

        return res.json({
            success: true,
            messages
        });

    } catch (error) {
        console.log(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};