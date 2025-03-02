        -- Users Table
        CREATE TABLE users (
            user_id SERIAL PRIMARY KEY,
            username VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE,
            first_name VARCHAR(255),
            last_name VARCHAR(255),
            user_type VARCHAR(50) NOT NULL CHECK (user_type IN ('user', 'lawyer', 'admin')),
            created_at TIMESTAMP DEFAULT NOW(),
            phone_number VARCHAR(20),
            address TEXT
        );
        CREATE TABLE payments (
            payment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id integer REFERENCES users(user_id),
            amount numeric(10, 2),
            payment_date date,
            hired_lawyer_id integer REFERENCES lawyers(lawyer_id),
            status bool DEFAULT false,
            currency VARCHAR(10) DEFAULT 'BDT',
            details text,
            created_at timestamp DEFAULT now(),
            updated_at timestamp DEFAULT now()
        );
        alter table users
        add column profile_picture_url text;

        alter table users
        add column is_verified boolean default false;


    ALTER TABLE lawyers
    ADD COLUMN latitude DECIMAL,
    ADD COLUMN longitude DECIMAL;

    alter table clients
    add column lawyer_id integer references lawyers(lawyer_id) on delete set null;

        -- Lawyers Table
        CREATE TABLE lawyers (
            lawyer_id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
            specialization VARCHAR(255),
            bar_number VARCHAR(100) UNIQUE,
            biography TEXT,
            rating DECIMAL(2,1) CHECK (rating >= 0 AND rating <= 5),
            location VARCHAR(255),
            practice_areas TEXT,
            profile_picture_url VARCHAR(255),
            office_contact_number VARCHAR(20)
        );
    alter table lawyers
    add column nid text;
        -- Clients table
        CREATE TABLE clients (
            client_id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
            --Add any other client related fields here if needed
            created_at TIMESTAMP DEFAULT NOW()

        );

alter table clients
add column status text;
select * from cases;

alter table cases
add column case_ text;

alter table cases
 add column caseDescription


        -- Legal Templates Table
        CREATE TABLE legal_templates (
            template_id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            file_path VARCHAR(255) NOT NULL,
            category VARCHAR(255),
            created_at TIMESTAMP DEFAULT NOW(),
            keywords TEXT
        );

        create table password_resets (
            reset_id uuid primary key default gen_random_uuid(),
            user_id integer not null references users(user_id) on delete cascade,
            token text,
            created_at timestamp default now(),
            expires_at timestamp default now() + interval '120 minutes'

        );
        

    create table otp (
        otp_id SERIAL PRIMARY KEY,
        email VARCHAR(255),
        user_id integer not null references users(user_id) on delete cascade,
        otp_code integer not null,
        created_at timestamp default now(),
        verified boolean default false,
        expires_at timestamp default now() + interval '120 minutes'
    );


        -- Cases Table
        CREATE TABLE cases (
            case_id SERIAL PRIMARY KEY,
            client_id INTEGER NOT NULL REFERENCES clients(client_id) ON DELETE CASCADE,
            lawyer_id INTEGER REFERENCES lawyers(lawyer_id) ON DELETE SET NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            status VARCHAR(50) DEFAULT 'Open',
            assigned_at TIMESTAMP DEFAULT NOW()
        );

            
        alter table cases
        alter column client_id drop NOT NULL;
        alter table cases
        alter column lawyer_id drop NOT NULL;

        create table hearings (
            hearing_id SERIAL PRIMARY KEY,
            case_id integer not null references cases(case_id) on delete cascade,
            details text,
            date date not null,
            time time not null,
            location text,
            description text,
            created_at timestamp default now()
        )

        ALTER TABLE HEARINGS ADD COLUMN status TEXT DEFAULT 'Pending'
        



        -- Tasks Table
        CREATE TABLE tasks (
            task_id SERIAL PRIMARY KEY,
            case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
            lawyer_id INTEGER REFERENCES lawyers(lawyer_id) ON DELETE SET NULL,
            description TEXT,
            due_date DATE,
            status VARCHAR(50) DEFAULT 'Pending',
            created_at TIMESTAMP DEFAULT NOW()
        );

        

        -- Documents Table
        CREATE TABLE documents (
            document_id SERIAL PRIMARY KEY,
            case_id INTEGER REFERENCES cases(case_id) ON DELETE CASCADE,
            template_id INTEGER REFERENCES legal_templates(template_id) ON DELETE SET NULL,
            user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
            file_path VARCHAR(255) NOT NULL,
            uploaded_at TIMESTAMP DEFAULT NOW(),
            document_type VARCHAR(50)
        );

        -- Payments Table
        CREATE TABLE payments (
            payment_id SERIAL PRIMARY KEY,
            case_id INTEGER REFERENCES cases(case_id) ON DELETE SET NULL,
            client_id INTEGER NOT NULL REFERENCES clients(client_id) ON DELETE CASCADE,
            lawyer_id INTEGER NOT NULL REFERENCES lawyers(lawyer_id) ON DELETE CASCADE,
            amount DECIMAL(10, 2) NOT NULL,
            payment_date TIMESTAMP DEFAULT NOW(),
            payment_method VARCHAR(255),
            status VARCHAR(50) DEFAULT 'Pending'
        );

        -- Chat Messages Table
        CREATE TABLE chat_messages (
            message_id SERIAL PRIMARY KEY,
            sender_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
            receiver_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
            message_text TEXT NOT NULL,
            sent_at TIMESTAMP DEFAULT NOW()
        );

        -- Courses Table
        CREATE TABLE courses (
        course_id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        instructor VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        content_url VARCHAR(255)
        );

        --UserCourse Table
        CREATE TABLE user_courses (
        user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        course_id INTEGER NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
            enrolled_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, course_id)
        );