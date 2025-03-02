import { Elysia, t } from 'elysia';
import cors from '@elysiajs/cors';
import { cookie } from '@elysiajs/cookie';
import { jwt } from '@elysiajs/jwt';
import sql from '../db/database';
import { Logestic } from 'logestic';
import {  getLawyerIdFromJWT } from '../functions/handlers'; 
// import { sendEmail } from '../utils/email';
// import bcrypt from 'bcryptjs'; 

import { v2 as cloudinary } from "cloudinary";

// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
// });

export const clients = new Elysia()
  .use(Logestic.preset('common'))
      .use(cors())
      .use(cookie())
      .use(jwt({
        name: 'jwt',
        secret: process.env.JWT_SECRET! 
      }))
      .get('/all', async ({ set, jwt, headers }) => {
        try {
            const lawyer_id = await getLawyerIdFromJWT(headers, jwt);
            if (!lawyer_id) {
                set.status = 401;
                return { error: 'Unauthorized' };
            }

            const clients = await sql`
                SELECT * FROM clients WHERE lawyer_id = ${lawyer_id}`

            set.status = 200;
            return { message: 'Fetched all clients', clients: clients};
        } catch (error: any) {
            console.error('Error geting clients:', error);
            set.status = 500;
            return { error: 'Failed to create case', details: error.message };
        }
    },)
    
      .get('/:id', async ({ params, set, headers, jwt }) => { // Get a specific client by ID
        const lawyer_id = await getLawyerIdFromJWT(headers, jwt);
        if (!lawyer_id) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }
          const { id } = params;
          try {
              const [client] = await sql`
                  SELECT
                      c.client_id, c.created_at as client_created_at,
                      u.user_id, u.username, u.email, u.first_name, u.last_name, u.phone_number, u.address, u.created_at as user_created_at
                  FROM clients c
                  JOIN users u ON c.user_id = u.user_id
                  WHERE c.client_id = ${id} AND c.lawyer_id = ${lawyer_id};
              `;
              if (!client) {
                  return new Response(JSON.stringify({ error: 'Client not found' }), { status: 404 });
              }
              return JSON.stringify(client);
          } catch (error) {
              console.error('Error fetching client:', error);
              return new Response(JSON.stringify({ error: 'Failed to fetch client', details: error.message }), { status: 500 });
          }
      })
      .post('/add', async ({ body, set, jwt, headers }) => {
            try {
                const lawyer_id = await getLawyerIdFromJWT(headers, jwt);
                if (!lawyer_id) {
                    set.status = 401;
                    return { error: 'Unauthorized' };
                }

                const { user_id, due_amount, status } = body;
                const [client] = await sql`
                    INSERT INTO clients (lawyer_id, user_id, due_amount, status)
                    VALUES (${lawyer_id}, ${user_id}, ${due_amount}, ${status})
                    RETURNING *;
                `;
                set.status = 201;
                return { message: 'Client added successfully', client };
            } catch (error) {
                console.error('Error adding client:', error);
                set.status = 500;
                return { error: 'Failed to add client', details: error.message };
            }
       })
        .put('/:id/:stat', async ({ params, body, headers, jwt }) => {
            const { id, stat } = params;
            try {
                const lawyer_id = await getLawyerIdFromJWT(headers, jwt);
                if (!lawyer_id) {
                    return new Response(JSON.stringify({ error: 'Not registered as Lawyer' }), { status: 401 });
                }
                const [client] = await sql`
                    SELECT * FROM clients WHERE client_id = ${id} AND lawyer_id = ${lawyer_id}`

                const { user_id, due_amount, status } = body;
                const [updatedClient] = await sql`
                    UPDATE clients SET
                        user_id = ${client.user_id},
                        status = ${stat}
                    WHERE client_id = ${id} AND lawyer_id = ${lawyer_id}
                    RETURNING *;
                `;
                if (!updatedClient) {
                    return new Response(JSON.stringify({ error: 'Client not found' }), {
                        status: 404,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                return new Response(JSON.stringify(updatedClient), { status: 200, headers: { 'Content-Type': 'application/json' } });
            } catch (error) {
                console.error('Error updating client:', error);
                return new Response(JSON.stringify({ error: 'Failed to update client', details: error.message }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }}, {
                body: t.Object({
                    user_id: t.String(),
                    due_amount: t.Number(),
                    status: t.String()
                })
            })
      // TODO: Add other client routes: list, create, update, delete
  