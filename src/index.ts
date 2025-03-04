  import { Elysia, t } from 'elysia';
  import cors from '@elysiajs/cors';
  import { cookie } from '@elysiajs/cookie';
  import { jwt } from '@elysiajs/jwt';
  import swagger from '@elysiajs/swagger';
  import sql from './db/database';
  import { Logestic } from 'logestic';
  import { getLawyerIdFromJWT, getUserIdFromJWT, getUserTypeFromJWT } from './functions/handlers'; 
  import { sendEmail } from './utils/email';
  import bcrypt from 'bcryptjs'; // For password hashing
import { payment } from './routes/payments';

  const app = new Elysia({
    name: "BartaBackend"
  })
  .use(Logestic.preset('common'))
    .use(cors())
    .use(cookie())
    .use(jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET! 
    }))
    .use(swagger())
    .group('/payments', app => payment)
  
      // --- Authentication Routes (Adapted for 'rm_users' table) ---
      .group('/auth', (app) => app
          .post('/signup', async ({ body, set, jwt, cookie }) => {
              const { password, email, first_name, last_name, user_type, address, nid, bar_number } = body;
              const passwordHash = await bcrypt.hash(password, 10); // Hash password
              const username = first_name.toLowerCase() + last_name.toLowerCase();
              username.replace(/\s/g, ''); // Remove spaces
  
              console.log('Signup request:', body, 'Generated username:', username, 'Password hash', passwordHash);
  
              try {
                  if(user_type === 'client'){
                  const [user] = await sql`
                      INSERT INTO rm_users (username, password_hash, email, first_name, last_name, user_type)
                      VALUES (${username}, ${passwordHash}, ${email}, ${first_name}, ${last_name}, ${user_type})
                      RETURNING user_id, username, email, user_type;
                  `;
                  set.status = 201; // Created
                  return { user };}
                  else if(user_type === 'lawyer'){
                    const [user] = await sql`
                      INSERT INTO rm_users (username, password_hash, email, first_name, last_name, user_type)
                      VALUES (${username}, ${passwordHash}, ${email}, ${first_name}, ${last_name}, ${user_type})
                      RETURNING user_id, username, email, user_type, first_name, last_name, phone_number, address, profile_picture_url`;
                     console.log("User: ", user);
                    const [lawyer] = await sql`
                      INSERT INTO lawyers (user_id, nid, bar_number)
                      VALUES (${user.user_id}, ${nid}, ${bar_number})
                      RETURNING lawyer_id, user_id, bar_number`;
                    console.log("Lawyer: ", lawyer);
                      const token = await jwt.sign({
                        user_id: user.user_id,
                        lawyer_id: lawyer.lawyer_id,
                        username: user.username,
                        userType: user.user_type,
                        email: user.email,
                      });
  
                      cookie.auth_token.set(token, {
                          httpOnly: true,
                          maxAge: 7 * 86400, // 7 days
                          path: '/',
                      });
  
                    set.status = 201; // Created
                    return { user, lawyer, 'token': token };
                  }
              } catch (error: any) {
                  if (error.code === '23505') { // Unique violation error code
                      set.status = 409; // Conflict
                      console.log(error)
                      return { message: 'Credentials exist.', error: error };
                  }
                  set.status = 500;
                  console.log('Error:', error);
                  return { error: 'Signup failed', details: error.message };
              }
          }, {
              body: t.Object({
                  password: t.String(),
                  email: t.String(),
                  first_name: t.Optional(t.String()),
                  last_name: t.Optional(t.String()),
                  bar_number: t.Optional(t.String()),
                  nid: t.Optional(t.String()),
                  user_type: t.String(),
                  // phone_number: t.Optional(t.String()),
              })
          })
  
  
          .post('/login', async ({ body, set, jwt, cookie: ck }) => {
              const { email, password, user_type} = body;
              console.log('Login request:', body);
  
              try {
                  const [user] = await sql`
                      SELECT * FROM rm_users WHERE email = ${email} AND user_type = ${user_type}
                  `;
  
                  if (!user) {
                      set.status = 403;
                      return { error: 'User not found. Please sign up first.' };
                  }
  
                  const passwordMatch = await bcrypt.compare(password, user.password_hash);
               /*    if (!passwordMatch) {
                      set.status = 401;
                      return { error: 'Invalid credentials' };
                  } */
                /*  if(password != user.password_hash)
                 {
                    set.status = 401;
                    return { error: 'Invalid credentials' };

                 } */
                  let lawyer, token;
                  if(user.user_type === 'lawyer'){
                      [lawyer] = await sql`
                      select * from lawyers where user_id = ${user.user_id}
                      `
                      token = await jwt.sign({
                        user_id: user.user_id,
                        lawyer_id: lawyer.lawyer_id,
                        username: user.username,
                        userType: user.user_type,
                        email: user.email,
                    });
                  }
                  else{
                    token = await jwt.sign({
                        user_id: user.user_id,
                        username: user.username,
                        userType: user.user_type,
                        email: user.email,
                    });
                  }
                  

  
                ck.auth_token.set(token, {
                      httpOnly: true,
                      maxAge: 7 * 86400, // 7 days
                      path: '/',
                  }); 
                  set.status = 200;
                  return { message: 'Login successful', token, lawyer,  user: { userId: user.user_id, username: user.username, userType: user.user_type, email: user.email, phone_number: user.phone_number, profile_picture_url : user.profile_picture_url } };
  
              } catch (error) {
                  set.status = 500;
                  return { error: 'Login failed', details: error.message };
              }
          }, {
              body: t.Object({
                  email: t.String(),
                  password: t.String(),
                  user_type: t.String()
              })
          })
  
  
  
          .post('/send-otp', async ({ body }) => {
              const {email} = body;
              console.log("email: ", email);
              const otp = Math.floor(100000 + Math.random() * 900000).toString();
              const otpExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
              let otpData;
              try{
              var [res] = await sql`
              SELECT user_id, phone_number, is_verified FROM rm_users WHERE email = ${email}
              `;
                console.log("res: ", res);
              if(res.length === 0) {
              return new Response(JSON.stringify({ error: 'User not found' }), {status: 404});
              }
              else if(res.is_verified) {
              return new Response(JSON.stringify({error: 'User already verified' }), {status: 401});
              }
              else if(res.otp_expiry > new Date()) {
              // TODO: uncomment this when SMS API SET, sending sms
              // var responseData = await sms_api_robi(phone_number, otp);
  
              // if(responseData.errorCode === '0') {
              //   otpData = responseData;
              // }
              // return new Response(JSON.stringify({otp: res[0].otp, smsDetails: responseData }), {status: 200});
              return new Response(JSON.stringify({otp: res[0].otp}), {status: 201});
              }
              try{
              const [otpUpdate] = await sql`
                  INSERT INTO OTP(user_id, email, otp_code, expires_at)
                  VALUES (${res.user_id}, ${email}, ${otp}, ${otpExpiry})
                  RETURNING *
              `;
              console.log("OTP inserted successfully for user: ", res.user_id);
              console.log("OTP: ", otp);
  
  
              return new Response(JSON.stringify({
                  smsStatus: JSON.stringify(otpData),
                  body: otpUpdate,
                  message: 'OTP sent successfully',
                  }), {
                  status: 200,
              });
  
              }
              catch(err) {
                  console.error('DB error while inserting otp for user:', err.message);
                  return new Response(JSON.stringify({error: 'Server error, while inserting otp' }), {status: 501});
              }
              }catch
              (err) {
              console.error('DB error while selecting user for /send-otp query error:', err.message);
              // throw new Error('Internal Server Error');
              return new Response(JSON.stringify({error: 'Server error, while selecting user' }), {status: 501});
              }
          }, {
              body: t.Object({ email: t.String()} )
          })
  
          .post('/verify-otp', async ({ body, jwt }) => {
              const { email, otp } = body;
  
              try {
              const [user] = await sql`
                  SELECT * FROM OTP WHERE email = ${email} ORDER BY expires_at DESC LIMIT 1
              `;
              
  
              if (user.otp_code !== Number(otp)) {
                console.error('Invalid or expired OTP, user:', user);
                console.log("real otp: ", user.otp_code, "entered otp: ", otp);
                return new Response(JSON.stringify({ error: 'Invalid or expired OTP' }), { status: 402 });
              }
  
              const [resQ] = await sql`
                  UPDATE rm_users
                  SET is_verified = true
                  WHERE user_id = ${user.user_id} RETURNING *
              `;
              console.log("User verified successfully: ", resQ);
  
              const token = await jwt.sign({
                  userId: resQ.user_id,
                  phone_number: resQ.phone_number,
                  image: resQ.profile_picture_url,
                  username: resQ.name,
              });
              console.log("new user token: ", token);
  
              console.log("User verified successfully: ", resQ);
              return { message: 'Email verified successfully', status: 200, result: resQ, token: JSON.stringify(token) };
              } catch (err) {
              console.error('DB error for /verify-otp :', err.message);
              return { error: 'Internal server or database error', status: 500 };
              }
  
          }, {
              body: t.Object({
              email: t.String(),
              otp: t.String({ minLength: 6, maxLength: 6 })
              })
          })

  
          .post('/forgot-password', async ({ body }) => {
              const { email } = body;
  
              try {
              const [user] = await sql`
                  SELECT * FROM rm_users WHERE email = ${email}
              `;
  
              if (!user) {
                  throw new Error('User not found');
              }
  
              const token = Math.random().toString(36).slice(2);
              const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  
              await sql`
                  INSERT INTO password_resets (user_id, token, expires_at)
                  VALUES (${user.user_id}, ${token}, ${expiresAt})
              `;
              
              const frontend_url = process.env.FRONTEND_URL || 'https://lawbridge.vercel.app';
              //TODO: send otp for reset password
  
              await sendEmail(
                  email,
                  'Reset Password',
                  `Click here to reset your password: ${frontend_url}/reset-password?token=${token}`
              );
  
              return { message: 'Password reset instructions sent to your email', emailContent: `Click here to reset your password:\n ${frontend_url}/reset-password?token=${token}` };
              } catch (err) {
              console.error('Database query error:', err);
              throw new Error('Internal Server Error');
              }
          }, {
              body: t.Object({
              email: t.String()
              })
          })
  
          .post('/reset-password', async ({ body }) => {
              const { token, newPassword } = body;
  
              try {
              const [reset] = await sql`
                  SELECT * FROM password_resets WHERE token = ${token}
              `;
  
              if (!reset || reset.expires_at < new Date()) {
                  throw new Error('Invalid or expired reset token');
              }
  
              const hashedPassword = await bcrypt.hash(newPassword, 10);
  
              await sql`
                  UPDATE rm_users
                  SET password = ${hashedPassword}
                  WHERE user_id = ${reset.user_id}
              `;
  
              await sql`
                  DELETE FROM password_resets WHERE reset_id = ${reset.reset_id}
              `;
  
              return { message: 'Password reset successfully' };
              } catch (err) {
              console.error('Database query error:', err);
              throw new Error('Internal Server Error');
              }
          }, {
              body: t.Object({
              token: t.String(),
              newPassword: t.String({ minLength: 6 })
              })
          })
  
        
  
          .put('/set-address', async ({ body, jwt, headers }) => {
              const { address } = body;
            console.log("Address: ", address);
              let userId: string;
              try {
              // Validate JWT Authorization Header
              const userId = await getUserIdFromJWT(headers, jwt);
              if(!userId) { return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401,});}
  
              const [res] = await sql`
              update rm_users set address = ${JSON.stringify(address)} where user_id = ${userId}  returning *
              `;
                console.log("Address set successfully: ", res);
              return { message: 'Address updated successfully', data: JSON.stringify(res) };
              } catch (err) {
              console.error('Database query error:', err);
              throw new Error('Internal Server Error');
              }
  
          },{
              body: t.Object({
              address: t.String()
              }),
          })
  
          .put('/update-profile', async ({ body, jwt, headers }) => {
          try {
              const userId = await getUserIdFromJWT(headers, jwt);
              if (!userId) {
              return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
              }
  
              const { first_name, last_name, phone_number, email, nid, address } = body;
              const updateData = {};
  
              if (first_name) updateData['first_name'] = first_name;
              if (last_name) updateData['last_name'] = last_name;
              if (phone_number) updateData['phone_number'] = phone_number;
              if (email) updateData['email'] = email;
              if (nid) updateData['nid'] = nid;
              if (address) updateData['address'] = JSON.stringify(address); // Store address as JSON string
  
              if (Object.keys(updateData).length === 0) {
              return new Response(JSON.stringify({ message: 'No fields to update' }), { status: 200 });
              }
  
              const [res] = await sql`
              UPDATE rm_users
              SET ${sql(updateData)}
              WHERE user_id = ${userId}
              RETURNING *
              `;
  
              return new Response(JSON.stringify({ message: 'Profile updated successfully',  res }), { status: 200 });
          } catch (error) {
              console.error('Error updating profile:', error);
              return new Response(JSON.stringify({ error: 'Failed to update profile' }), { status: 500 });
          }
          }, {
          body: t.Object({
            first_name: t.Optional(t.String()),
            last_name: t.Optional(t.String()),
              phone_number: t.Optional(t.String()),
              email: t.Optional(t.String()),
              nid: t.Optional(t.String()),
              address: t.Optional(t.Object({
              street: t.String(),
              town: t.String(),
              district: t.String(),
              zip: t.Number()
              }))
          })
          })
  
          .delete('/user/delete', async ({ body, jwt, headers }) => {
          const userId = await getUserIdFromJWT(headers, jwt);
          if(!userId) { return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401,});}
          console.log("User delete approached: ", userId);
          const {password, phone_number} = body;
          try {
              const [user] = await sql`
              SELECT * FROM public.rm_users WHERE user_id = ${userId}
              `;
              
              if(!user) {
              return new Response( JSON.stringify({ error: 'User not found' }), {
                  status: 404,
              });
              }
              console.log("User pass: ", user.password, "Entered:", password);
              const validPassword = await bcrypt.compare(password, user.password_hash);
              if (!validPassword) {
              throw  new Response( JSON.stringify({ error: 'Invalid Password' }), {
                  status: 403,
              });
              }
          } catch (error) {
              console.error('Error fetching user:', error);
              return new Response( JSON.stringify({ error: error.message || error }), {
              status: 500,
              });
          }
  
          try {
              const result = await sql`
              DELETE FROM rm_users WHERE user_id = ${userId} RETURNING *
              `;
              console.log("User deleted successfully: ", result);
              if(result){return new Response(JSON.stringify({ message: 'User deleted successfully', result }), { status: 200 } );}
          } catch (error) {
              console.error('Error deleting user:', error);
              return new Response( JSON.stringify({ error: error.message || error }), {
              status: 500,
              });
          }
  
          }, {
          body: t.Object({email: t.String(), password: t.String()})
          })
            )

        .group('/chat', app => app
            .get('/messages', async ({ query, set }) => {
                try {
                  const { userId, conversationWith } = query;
                  const cur_time = new Date(Date.now()); 
              
                  if (!userId || !conversationWith) {
                    set.status = 400;
                    return { error: "Missing userId or conversationWith" };
                  }
              
                  const messages = await sql`
                    SELECT * FROM messages 
                    WHERE 
                      (sender_id = ${userId} AND reciever_id = ${conversationWith} AND expiresAt > ${cur_time}) 
                      OR 
                      (sender_id = ${conversationWith} AND reciever_id = ${userId} AND expiresAt > ${cur_time})
                    ORDER BY sent_at ASC;
                  `;
              
                  return JSON.stringify({ messages });
                } catch (error: any) {
                  console.error("Error fetching messages:", error);
                  set.status = 500;
                  return { error: "Failed to fetch messages", details: error.message };
                }
              })
              
              
              // POST /messages: Create a new message
              .post('/messages', async ({ body, set }) => {
                const { content, expiresAt, userId , conversationWith} = body;
                try {
                    const cur_time = new Date(Date.now()); 
                    const expired_time = new Date(Date.now() + expiresAt * 1000);
          
                  const [message] = await sql`
                    INSERT INTO messages (content,  sender_id, expiresAt, sent_at, reciever_id)
                    VALUES (
                      ${content},
                      ${userId},
                       ${expired_time},
                        ${cur_time},
                        ${conversationWith}

                       
                    )
                    RETURNING *
                  `;
                  set.status = 201;
                  return message;
                } catch (error) {
                  set.status = 500;
                  return { error: 'Failed to post message', details: error.message };
                }
              }, {
                body: t.Object({
                  content: t.String(),
                  expiresAt: t.Optional(t.Number()),
                  userId: t.Number(),
                  conversationWith: t.Number()
                })
              })


              .get('/conversations/:userId', async ({ params, set, jwt, headers }) => {
                const userId = params.userId;

                try {
                  /*   const userId = await getUserIdFromJWT(headers, jwt);
                    if (!userId) {
                        set.status = 401;
                        return { error: 'Unauthorized! login first' };
                    }
     */
                    const conversations = await sql`
                    SELECT DISTINCT u.user_id, u.first_name ,u.email, u.avatar
             FROM rm_users u
             JOIN messages m ON u.user_id = m.sender_id OR u.user_id = m.reciever_id
             WHERE (m.sender_id = ${userId} OR m.reciever_id = ${userId}) and u.user_id != ${userId}; 
                     
                    `;
                    return JSON.stringify({conversations});
    
                } catch (error: any) {
                    console.error('Error fetching conversations:', error);
                    set.status = 500;
                    return { error: 'Failed to fetch conversations', details: error.message };
                }
            }
    
        ))
        
   

    .get('/', async () => {
      return {
        status: 'Barta Backend Server is running fine'
      };
    })  
 

        .listen({
        port: process.env.PORT || 8000,
        hostname: process.env.HOST || '0.0.0.0',
        idleTimeout: 255}
        );

        console.log(`Barta Backend Server is running on http://${process.env.HOST}:${process.env.PORT}`);