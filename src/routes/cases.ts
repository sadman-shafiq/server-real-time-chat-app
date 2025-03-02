import { Elysia, t } from 'elysia';
import cors from '@elysiajs/cors';
import { cookie } from '@elysiajs/cookie';
import { jwt } from '@elysiajs/jwt';
import sql from '../db/database';
import { Logestic } from 'logestic';
import { getLawyerIdFromJWT, getUserIdFromJWT, getUserTypeFromJWT } from '../functions/handlers'; 
// import { sendEmail } from '../utils/email';
// import bcrypt from 'bcryptjs'; 

// import { v2 as cloudinary } from "cloudinary";

// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
// });

export const cases = new Elysia()
  .use(Logestic.preset('common'))
      .use(cors())
      .use(cookie())
      .use(jwt({
        name: 'jwt',
        secret: process.env.JWT_SECRET! 
      }))
      
        // View Case (by case ID)
        
        .get('/:id', async ({ params, set, jwt, headers }) => {
            const caseId = params.id;
            try {
                const [caseData] = await sql`
                     SELECT
                      ca.case_id, ca.title, ca.description, ca.created_at, ca.status, ca.assigned_at,
                      cl.client_id,
                      law.lawyer_id, ca.prosecution, ca.defense, ca.judge
                  FROM cases ca
                  JOIN clients cl ON ca.client_id = cl.client_id
                  LEFT JOIN lawyers law ON ca.lawyer_id = law.lawyer_id
                  WHERE ca.case_id = ${caseId}
                `;
                if (!caseData) {
                    set.status = 404;
                    return { error: 'Case not found' };
                }
                return caseData;
            } catch (error) {
                console.error('Error fetching case:', error);
                set.status = 500;
                return { error: 'Failed to fetch case', details: error.message };
            }
        })
        // Add Case details (from client )
        .post('/client/req', async ({ body, set, jwt, headers }) => {
            try {
                const userId = await getUserIdFromJWT(headers, jwt);
                if (!userId) {
                    set.status = 401;
                    return { error: 'Unauthorized' };
                } 

                const { caseType, caseTitle, court, location, hearingDate, caseFiles, description, lawyer_id } = body;
                let [lawyer] = await sql`SELECT * FROM public.lawyers WHERE lawyer_id = ${lawyer_id}`;
                
                // Check if user is a client, if not create a client profile
                let [client] = await sql`SELECT * FROM public.clients WHERE user_id = ${userId}`;
                if (!client) {
                    [client] = await sql`
                        INSERT INTO public.clients (lawyer_id, user_id, due_amount, status) VALUES (${lawyer_id},${userId}, ${lawyer.fees}, 'pending') RETURNING *;
                    `;
                }

                // const [newCase] = await sql`
                //     INSERT INTO cases (client_id, lawyer_id, title, description)
                //     VALUES (${userId},${lawyer_id}, ${caseTitle}, ${description})
                //     RETURNING *;
                // `;
                set.status = 201;
                return { message: 'Lawyer req submitted successfully', info: client };
            } catch (error: any) {
                console.error('Error creating case:', error);
                set.status = 500;
                return { error: 'Failed to create case', details: error.message };
            }
        }, {
            body: t.Object({
                caseTitle: t.String(),
                caseType: t.String(), 
                court: t.String(), 
                location: t.String(), 
                hearingDate: t.Date(), 
                caseFiles: t.String(), 
                lawyer_id: t.Integer(),
                description: t.Optional(t.String())
            })
        })
        // Add Case details (from client )
        // .post('/lawyer/all-req', async ({ body, set, jwt, headers }) => {
        //     try {
        //         const lawyer_id = await getLawyerIdFromJWT(headers, jwt);
        //         if (!lawyer_id) {
        //             set.status = 401;
        //             return { error: 'Unauthorized' };
        //         }

        //         // const { caseType, caseTitle, court, location, hearingDate, caseFiles, description, lawyer_id } = body;
        //         let [lawyer] = await sql`SELECT * FROM public.lawyers WHERE lawyer_id = ${lawyer_id}`;
                
        //         // Check if user is a client, if not create a client profile
        //         let [client] = await sql`SELECT * FROM public.clients WHERE user_id = ${userId}`;
        //         if (!client) {
        //             [client] = await sql`
        //                 INSERT INTO public.clients (lawyer_id, user_id, due_amount, status) VALUES (${lawyer_id},${userId}, ${lawyer.fees}, 'pending') RETURNING *;
        //             `;
        //         }

        //         // const [newCase] = await sql`
        //         //     INSERT INTO cases (client_id, lawyer_id, title, description)
        //         //     VALUES (${userId},${lawyer_id}, ${caseTitle}, ${description})
        //         //     RETURNING *;
        //         // `;
        //         set.status = 201;
        //         return { message: 'Lawyer req submitted successfully', info: client };
        //     } catch (error: any) {
        //         console.error('Error creating case:', error);
        //         set.status = 500;
        //         return { error: 'Failed to create case', details: error.message };
        //     }
        // }, {
        //     body: t.Object({
        //         caseTitle: t.String(),
        //         caseType: t.String(), 
        //         court: t.String(), 
        //         location: t.String(), 
        //         hearingDate: t.Date(), 
        //         caseFiles: t.String(), 
        //         lawyer_id: t.Integer(),
        //         description: t.Optional(t.String())
        //     })
        // })
        // Add Case details (from client )
        .post('/lawyer', async ({ body, set, jwt, headers }) => {
            try {
                const lawyer_id = await getLawyerIdFromJWT(headers, jwt);
                if (!lawyer_id) {
                    set.status = 401;
                    return { error: 'Unauthorized' };
                }

                const { title, description, user_id } = body;

                let [clients] = await sql`SELECT * FROM clients WHERE lawyer_id = ${lawyer_id}`;
                if (!clients) {
                    [clients] = await sql`
                        INSERT INTO clients (lawyer_id, user_id) VALUES (${lawyer_id}, ${user_id}) RETURNING *;
                    `;
                }
                const [newCase] = await sql`
                    INSERT INTO cases (client_id, title, description)
                    VALUES (${clients.client_id}, ${title}, ${description})
                    RETURNING *;
                `;
                set.status = 201;
                return { message: 'Case created successfully', case: newCase, clients: clients };
            } catch (error: any) {
                console.error('Error creating case:', error);
                set.status = 500;
                return { error: 'Failed to create case', details: error.message };
            }
        }, {
            body: t.Object({
                title: t.String(),
                user_id : t.Integer(),
                description: t.Optional(t.String())
            })
        })
        // Update Case (from lawyer or client)
        .put('/client/:id', async ({ params, body, set, jwt, headers }) => {
            const caseId = params.id;
            try {
                const lawyer_id = await getLawyerIdFromJWT(headers, jwt);
                if (!lawyer_id) {
                    set.status = 401;
                    return { error: 'Unauthorized' };
                }
                const user_id = await getUserIdFromJWT(headers, jwt);

                // Basic check: Ensure user is either client or lawyer involved in the case (Enhance authorization later)
                const [caseData] = await sql`
                    SELECT ca.*, cl.user_id as client_user_id, law.user_id as lawyer_user_id
                    FROM cases ca
                    LEFT JOIN clients cl ON ca.client_id = cl.client_id
                    LEFT JOIN lawyers law ON ca.lawyer_id = law.lawyer_id
                    WHERE ca.case_id = ${caseId};
                `;

                if (!caseData) {
                    set.status = 404;
                    return { error: 'Case not found' };
                }

                if (caseData.lawyer_id !== lawyer_id && caseData.lawyer_user_id !== user_id) {
                    set.status = 403;
                    return { error: 'Not authorized to update this case' }; // Basic auth check
                }


                const { title, description, status, client_id } = body; // Allow updating lawyer_id here for assignment
                const updateData: any = {};
                if (title) updateData.title = title;
                if (description) updateData.description = description;
                if (status) updateData.status = status;
                if (client_id) updateData.client_id = client_id; // Allow lawyer assignment via update

                const [updatedCase] = await sql`
                    UPDATE cases
                    SET ${sql(updateData)}
                    WHERE case_id = ${caseId}
                    RETURNING *;
                `;
                if (!updatedCase) {
                    set.status = 404; // Should not happen if caseData was found but good to handle
                    return { error: 'Case update failed' };
                }
                return { message: 'Case updated successfully', case: updatedCase };

            } catch (error: any) {
                console.error('Error updating case:', error);
                set.status = 500;
                return { error: 'Failed to update case', details: error.message };
            }
        }, {
            body: t.Object({
                title: t.Optional(t.String()),
                description: t.Optional(t.String()),
                status: t.Optional(t.String()),
                client_id: t.Optional(t.Integer()) // Lawyer ID to assign
            })
        })
        .put('/lawyers/:id', async ({ params, body, set, jwt, headers }) => {
          const caseId = params.id;
          try {
              const userId = await getUserIdFromJWT(headers, jwt);
              if (!userId) {
                  set.status = 401;
                  return { error: 'Unauthorized' };
              }

              // Basic check: Ensure user is either client or lawyer involved in the case (Enhance authorization later)
              const [caseData] = await sql`
                  SELECT ca.*, cl.user_id as client_user_id, law.user_id as lawyer_user_id
                  FROM cases ca
                  LEFT JOIN clients cl ON ca.client_id = cl.client_id
                  LEFT JOIN lawyers law ON ca.lawyer_id = law.lawyer_id
                  WHERE ca.case_id = ${caseId};
              `;

              if (!caseData) {
                  set.status = 404;
                  return { error: 'Case not found' };
              }

              if (caseData.client_user_id !== userId && caseData.lawyer_user_id !== userId) {
                  set.status = 403;
                  return { error: 'Not authorized to update this case' }; // Basic auth check
              }


              const { title, description, status, lawyer_id } = body; // Allow updating lawyer_id here for assignment
              const updateData: any = {};
              if (title) updateData.title = title;
              if (description) updateData.description = description;
              if (status) updateData.status = status;
              if (lawyer_id) updateData.lawyer_id = lawyer_id; // Allow lawyer assignment via update

              const [updatedCase] = await sql`
                  UPDATE cases
                  SET ${sql(updateData)}
                  WHERE case_id = ${caseId}
                  RETURNING *;
              `;
              if (!updatedCase) {
                  set.status = 404; // Should not happen if caseData was found but good to handle
                  return { error: 'Case update failed' };
              }
              return { message: 'Case updated successfully', case: updatedCase };

          } catch (error: any) {
              console.error('Error updating case:', error);
              set.status = 500;
              return { error: 'Failed to update case', details: error.message };
          }
      }, {
          body: t.Object({
              title: t.Optional(t.String()),
              description: t.Optional(t.String()),
              status: t.Optional(t.String()),
              lawyer_id: t.Optional(t.Integer()) // Lawyer ID to assign
          })
      })
        // Get cases by lawyer ID
        .get('/lawyer/:lawyerId', async ({ params, set, jwt, headers }) => {
            const lawyerId = params.lawyerId;
            try {
                const userId = await getUserIdFromJWT(headers, jwt);
                if (!userId) {
                    set.status = 401;
                    return { error: 'Unauthorized' };
                }

                const cases = await sql`
                    SELECT
                        ca.case_id, ca.client_id, ca.lawyer_id, ca.title, ca.description, ca.created_at, ca.status, ca.assigned_at
                    FROM cases ca
                    WHERE ca.lawyer_id = ${lawyerId};
                `;
                return JSON.stringify({cases});
            } catch (error: any) {
                console.error('Error fetching cases for lawyer:', error);
                set.status = 500;
                return { error: 'Failed to fetch cases for lawyer', details: error.message };
            }
        })
        // Get cases by client ID
        .get('/client/:clientId', async ({ params, set, jwt, headers }) => {
            const clientId = params.clientId;
            try {
                 /*  const userId = await getUserIdFromJWT(headers, jwt);
                if (!userId) {
                    set.status = 401;
                    return { error: 'Unauthorized' };
                } */

                const cases = await sql`
                    SELECT
                        ca.case_id, ca.client_id, ca.lawyer_id, ca.title, ca.description, ca.created_at, ca.status, ca.assigned_at
                    FROM cases ca
                    WHERE ca.client_id = ${clientId};
                `;
                return JSON.stringify({cases});
            } catch (error: any) {
                console.error('Error fetching cases for client:', error);
                set.status = 500;
                return { error: 'Failed to fetch cases for client', details: error.message };
            }
        })
        // List all cases (Admin or Lawyer - adjust auth as needed)
        .get('/', async ({ set, jwt, headers }) => {
            try {
                const userId = await getUserIdFromJWT(headers, jwt);
                if (!userId) {
                    set.status = 401;
                    return { error: 'Unauthorized! Login first' };
                }
                const userType = await getUserTypeFromJWT(headers, jwt);
                if(userType !== 'admin'){
                      set.status = 401;
                      return { error: 'Unauthorized! Only for admins' };
                }

                const cases = await sql`
                    SELECT
                        ca.case_id, ca.client_id, ca.lawyer_id, ca.title, ca.description, ca.created_at, ca.status, ca.assigned_at
                    FROM cases ca;
                `;
                return cases;
            } catch (error: any) {
                console.error('Error fetching all cases:', error);
                set.status = 500;
                return { error: 'Failed to fetch all cases', details: error.message };
            }
        })
    