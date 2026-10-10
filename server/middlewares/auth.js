import { getAuth } from '@clerk/express';

export const protect = (req, res, next) => {
    try {
        const { userId } = getAuth(req);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "not authenticated"
            });
        }

        next();

    } catch (error) {
        console.log(error);

        res.status(401).json({
            success: false,
            message: error.message
        });
    }
};