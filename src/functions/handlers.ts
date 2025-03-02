
async function getUserIdFromJWT(headers: any, jwt: any) {
    const authHeader = headers.authorization;
    // console.log('authHeader:', authHeader, 'jwt:', jwt);
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
    }

    const token = authHeader.split(' ')[1];
    console.log('token:', token);
    try {
    const decoded = await jwt.verify(token) as { user_id: string};
    console.log('decoded userId:', decoded.user_id);
    return decoded.user_id;
    } catch (error) {
        console.error('Error verifying token:', error);
        return null;
    }
}
async function getUserTypeFromJWT(headers: any, jwt: any) {
    const authHeader = headers.authorization;
    // console.log('authHeader:', authHeader, 'jwt:', jwt);
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
    }

    const token = authHeader.split(' ')[1];
    // console.log('token:', token);
    try {
    const decoded = await jwt.verify(token) as { userType: string};
    console.log('decoded type:', decoded.userType);
    return decoded.userType;
    } catch (error) {
        console.error('Error verifying token:', error);
        return null;
    }
}

async function getLawyerIdFromJWT(headers: any, jwt: any) {
    const authHeader = headers.authorization;
    // console.log('authHeader:', authHeader, 'jwt:', jwt);
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
    }

    const token = authHeader.split(' ')[1];
    // console.log('token:', token);
    try {
    const decoded = await jwt.verify(token) as { lawyer_id: string};
    console.log('decoded lawyer:', decoded.lawyer_id);
    return decoded.lawyer_id;
    } catch (error) {
        console.error('Error verifying token:', error);
        return null;
    }
}


async function getAllInfoFromJWT(headers: any, jwt: any) {
    const authHeader = headers.authorization;
    // console.log('authHeader:', authHeader, 'jwt:', jwt);
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
    }

    const token = authHeader.split(' ')[1];
    // console.log('token:', token);
    try {
    const decoded = await jwt.verify(token) as {uid: string , username: string, userType: string, email: string };
    console.log('decoded:', decoded);
    return decoded;
    } catch (error) {
        console.error('Error verifying token:', error);
        return null;
    }
}

export { getUserIdFromJWT, getAllInfoFromJWT, getUserTypeFromJWT, getLawyerIdFromJWT };