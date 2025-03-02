import { Elysia, t } from 'elysia';
import cors from '@elysiajs/cors';
import { cookie } from '@elysiajs/cookie';
import { jwt } from '@elysiajs/jwt';
import sql from '../db/database';
import { Logestic } from 'logestic';
import { getUserIdFromJWT, getLawyerIdFromJWT,getUserTypeFromJWT } from '../functions/handlers'; 
// import { sendEmail } from '../utils/email';
// import bcrypt from 'bcryptjs'; 

import { v2 as cloudinary } from "cloudinary";

// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
// });

export const lawyers = new Elysia()
  .use(Logestic.preset('common'))
      .use(cors())
      .use(cookie())
      .use(jwt({
        name: 'jwt',
        secret: process.env.JWT_SECRET! 
      }))
      .get('/', async () => { // Get all lawyers (or with filters later)
        try {
          const lawyers = await sql`
              SELECT
              l.lawyer_id, l.specialization, l.bar_number, l.fees, l.biography, l.rating, l.location, l.practice_areas, l.profile_picture_url, l.office_contact_number, l.nid,
              u.user_id, u.username, u.email, u.first_name, u.last_name, u.phone_number, u.address, u.created_at as user_created_at
              FROM lawyers l
              JOIN users u ON l.user_id = u.user_id
              ORDER BY l.rating DESC;
          `;
          return new Response(JSON.stringify({lawyers}), {status:200});
        } catch (error) {
          console.error('Error fetching lawyers:', error);
          return new Response(JSON.stringify({ error:   'Failed to fetch lawyers', details: error.message }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' } // Explicitly set Content-Type
          });
        }
    })
    .get('/:id', async ({ params }) => { // Get a specific lawyer by ID
        const { id } = params;
        console.log("invoked get lawyer ")
        try {
            const [lawyer] = await sql`
            SELECT
            l.lawyer_id, l.specialization, l.bar_number, l.biography, l.fees, l.rating, l.location, l.practice_areas, 
            l.profile_picture_url, l.office_contact_number, l.nid,
            u.user_id, u.username, u.email, u.first_name, u.last_name, u.phone_number, u.address, u.created_at as user_created_at
            FROM lawyers l
            JOIN users u ON l.user_id = u.user_id
            WHERE l.lawyer_id = ${id};
            `;
            if (!lawyer) {
              return new Response(JSON.stringify({ error: 'Lawyer not found' }), {
                  status: 404,
                  headers: { 'Content-Type': 'application/json' }
              });
            }
          return JSON.stringify(lawyer); // Return lawyer object directly for Elysia to serialize to JSON
        } catch (error) {
            console.error('Error fetching lawyer:', error);
              return new Response(JSON.stringify({ error: 'Failed to fetch lawyer', details: error.message }), {
                  status: 500,
                  headers: { 'Content-Type': 'application/json' }
              });
          }
      })
            // --- Lawyer Profile Route ---
      .get('/me', async ({ jwt, headers, set }) => {
          try {
              const lawyerId = await getLawyerIdFromJWT(headers, jwt);
              const userType = await getUserTypeFromJWT(headers, jwt);
              if (!lawyerId) {
                  set.status = 401;
                  return { error: 'Unauthorized' };
              }
              if(!userType){
                  set.status = 401;
                  return { error: 'You\'re not registered as a Lawyer' };
              }

              const [lawyerProfile] = await sql`
                  SELECT
                      l.lawyer_id, l.specialization, l.bar_number, l.biography, l.rating, l.location, l.practice_areas, l.profile_picture_url, l.office_contact_number, l.nid,
                      u.user_id, u.username, u.email, u.first_name, u.last_name, u.phone_number, u.address, u.created_at as user_created_at
                  FROM lawyers l
                  RIGHT JOIN users u ON l.user_id = u.user_id
                  WHERE l.lawyer_id = ${lawyerId};
              `;

              if (!lawyerProfile) {
                  set.status = 404;
                  return { error: 'Lawyer profile not found' };
              }

              return JSON.stringify(lawyerProfile);
          } catch (error: any) {
              console.error('Error fetching lawyer profile:', error);
              set.status = 500;
              return { error: 'Failed to fetch lawyer profile', details: error.message };
          }
      })
      .post('/add', async ({ jwt, headers, body }) => { // Create a new lawyer
          try {
              const user_id = await getUserIdFromJWT(headers, jwt);
              if (!user_id) {
                  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
              }

              const {specialization, bar_number, biography, rating, location, practice_areas, profile_picture_url, office_contact_number, nid} = body;
              const [newLawyer] = await sql`
                  INSERT INTO lawyers (
                      specialization, bar_number, biography, rating, location, practice_areas, profile_picture_url, office_contact_number, nid, user_id
                  ) VALUES (
                      ${specialization}, ${bar_number}, ${biography}, ${rating}, ${location}, ${practice_areas}, ${profile_picture_url}, ${office_contact_number}, ${nid}, ${user_id}
                  ) RETURNING *;
              `;
              return new Response(JSON.stringify(newLawyer), { status: 201, headers: { 'Content-Type': 'application/json' } });
          } catch (error) {
              console.error('Error creating lawyer:', error);
              return new Response(JSON.stringify({ error: 'Failed to create lawyer', details: error.message }), {
                  status: 500,
                  headers: { 'Content-Type': 'application/json' }
              });
          }
      }, {
          body: t.Object({
              specialization: t.String(),
              bar_number: t.String(),
              biography: t.String(),
              rating: t.Number(),
              location: t.String(),
              practice_areas: t.String(),
              profile_picture_url: t.String(),
              office_contact_number: t.String(),
              nid: t.String(),
              user_id: t.String()
          })
      })
      .put('/:id', async ({ params, body, headers, jwt }) => { // Update an existing lawyer
          const { id } = params;
          try {
              const lawyer_id = await getLawyerIdFromJWT(headers, jwt);
              if (!lawyer_id) {
                  return new Response(JSON.stringify({ error: 'Not registered as Lawyer' }), { status: 401 });
              }
              const {specialization, bar_number, biography, rating, location, practice_areas, profile_picture_url, office_contact_number, nid} = body;
              const [updatedLawyer] = await sql`
                  UPDATE lawyers SET
                      specialization = ${specialization},
                      bar_number = ${bar_number},
                      biography = ${biography},
                      rating = ${rating},
                      location = ${location},
                      practice_areas = ${practice_areas},
                      profile_picture_url = ${profile_picture_url},
                      office_contact_number = ${office_contact_number},
                      nid = ${nid}
                  WHERE lawyer_id = ${lawyer_id}
                  RETURNING *;
              `;
              if (!updatedLawyer) {
                  return new Response(JSON.stringify({ error: 'Lawyer not found' }), {
                      status: 404,
                      headers: { 'Content-Type': 'application/json' }
                  });
              }
              return new Response(JSON.stringify(updatedLawyer), { status: 200, headers: { 'Content-Type': 'application/json' } });
          } catch (error) {
              console.error('Error updating lawyer:', error);
              return new Response(JSON.stringify({ error: 'Failed to update lawyer', details: error.message }), {
                  status: 500,
                  headers: { 'Content-Type': 'application/json' }
              });
          }
      }, {
          body: t.Object({
              specialization: t.String(),
              bar_number: t.String(),
              biography: t.String(),
              rating: t.Number(),
              location: t.String(),
              practice_areas: t.String(),
              profile_picture_url: t.String(),
              office_contact_number: t.String(),
              nid: t.String(),
              user_id: t.String()
          })
      })
      .delete('/:id', async ({ params, body }) => { // Delete a lawyer
          const { id } = params
          const { password , nid, bar_number} = body;
          try {
              const [deletedLawyer] = await sql`
                  DELETE FROM lawyers
                  WHERE lawyer_id = ${id} AND nid = ${nid} AND bar_number = ${bar_number}
                  RETURNING *;
              `;
              if (!deletedLawyer) {
                  return new Response(JSON.stringify({ error: 'Lawyer not found' }), {
                      status: 404,
                      headers: { 'Content-Type': 'application/json' }
                  });
              }
              return new Response(JSON.stringify(deletedLawyer), { status: 200, headers: { 'Content-Type': 'application/json' } });
          } catch (error) {
              console.error('Error deleting lawyer:', error);
              return new Response(JSON.stringify({ error: 'Failed to delete lawyer', details: error.message }), {
                  status: 500,
                  headers: { 'Content-Type': 'application/json' }
              });
          }
      }, {
          body: t.Object({
              password: t.String(),
              bar_number: t.String(),
              nid: t.String()
          })
      })
      
      .post('/nearby', async ({ body, set }) => {
      const { latitude, longitude, radius } = body;
      console.log(body)

      if (!latitude || !longitude || !radius) {
          set.status = 400;
          return { message: 'Latitude, longitude, and radius are required' };
      }

      const lat = parseFloat(latitude);
      const lon = parseFloat(longitude);
      const rad = parseFloat(radius);

      if (isNaN(lat) || isNaN(lon) || isNaN(rad)) {
          set.status = 400;
          return { message: 'Invalid latitude, longitude, or radius values' };
      }
      console.log('Searching for lawyers within', rad, 'km of', lat, lon);
      // Earth's radius in kilometers
      // const earthRadiusKm = 6371;
      try {
          const result = await sql`
          SELECT
          lawyers.*,
          users.first_name,
          users.last_name,
          users.email,
          users.profile_picture_url,
          users.phone_number
          FROM lawyers
          INNER JOIN users ON lawyers.user_id = users.user_id
          WHERE ST_DWithin(
          geography(ST_MakePoint(longitude, latitude)),
          geography(ST_MakePoint(${lon}, ${lat})),
          ${rad} * 1000
          )
      `;
      console.log('Found: ', result, 'lawyers within', rad, 'km of', lat, lon);
          return { lawyers: result };
      } catch (error) {
          console.error('Database error:', error);
          set.status = 500;
          return { message: 'Failed to fetch lawyers', error: error.message };
      }
      }, {
          body: t.Object({
              latitude: t.Number(),
              longitude: t.Number(),
              radius: t.Number(),
          }),
      })
      .post('/search', async ({body }) => { // Search for lawyers
          let {specialization, location, practice_areas, name} = body
          specialization = specialization || '';  
          location= location || ' ';
          practice_areas = practice_areas || '';
          name = name || '';
          try {
              const lawyers = await sql`
                  SELECT
                  l.lawyer_id, l.specialization, l.bar_number, l.biography, l.rating, l.location, l.practice_areas, l.profile_picture_url, l.office_contact_number, l.nid,
                  u.user_id, u.username, u.email, u.first_name, u.last_name, u.phone_number, u.address, u.created_at as user_created_at
                  FROM lawyers l
                  JOIN users u ON l.user_id = u.user_id
                  WHERE l.specialization ILIKE ${'%' + specialization + '%'}
                  OR l.location ILIKE ${'%' + location + '%'}
                  OR l.practice_areas ILIKE ${'%' + practice_areas + '%'}
                  OR u.first_name ILIKE ${'%' + name + '%'}
                  OR u.last_name ILIKE ${'%' + name + '%'}
                  ORDER BY l.rating DESC;
              `;
              return new Response(JSON.stringify({lawyers}), {status:200});
          } catch (error) {
              console.error('Error searching lawyers:', error);
              return new Response(JSON.stringify({ error: 'Failed to search lawyers', details: error.message }), {
                  status: 500,
                  headers: { 'Content-Type': 'application/json' }
              });
          }
      }, {
          body: t.Object({
              specialization: t.Optional(t.String()),
              location: t.Optional(t.String()),
              practice_areas: t.Optional(t.String()),
              name: t.Optional(t.String()),
              
              latitude: t.Optional(t.Number()),
              longitude: t.Optional(t.Number()),
              radius: t.Number(),
          })
      })
