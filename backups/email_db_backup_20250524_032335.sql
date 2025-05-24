--
-- PostgreSQL database dump
--

-- Dumped from database version 14.17 (Homebrew)
-- Dumped by pg_dump version 16.8 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: yasseralmohammed
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO yasseralmohammed;

--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


--
-- Name: account_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.account_type AS ENUM (
    'gmail',
    'exchange'
);


ALTER TYPE public.account_type OWNER TO postgres;

--
-- Name: auth_method; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.auth_method AS ENUM (
    'app_password',
    'oauth',
    'basic'
);


ALTER TYPE public.auth_method OWNER TO postgres;

--
-- Name: link_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.link_type AS ENUM (
    'thread',
    'subject',
    'semantic'
);


ALTER TYPE public.link_type OWNER TO postgres;

--
-- Name: llm_provider; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.llm_provider AS ENUM (
    'ollama',
    'openai',
    'anthropic',
    'perplexity'
);


ALTER TYPE public.llm_provider OWNER TO postgres;

--
-- Name: priority; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.priority AS ENUM (
    'high',
    'medium',
    'low'
);


ALTER TYPE public.priority OWNER TO postgres;

--
-- Name: task_category; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.task_category AS ENUM (
    'FollowUp_ResponseNeeded',
    'Report_Generation_Submission',
    'Meeting_Coordination_Prep',
    'Review_Approval_Feedback',
    'Research_Investigation_Analysis',
    'Planning_Strategy_Development',
    'Client_Vendor_Communication',
    'Internal_Project_Task',
    'Administrative_Logistics',
    'Urgent_Action_Required',
    'Information_To_Digest_Review',
    'Personal_Reminder_Appt'
);


ALTER TYPE public.task_category OWNER TO postgres;

--
-- Name: email_fts; Type: TEXT SEARCH CONFIGURATION; Schema: public; Owner: postgres
--

CREATE TEXT SEARCH CONFIGURATION public.email_fts (
    PARSER = pg_catalog."default" );

ALTER TEXT SEARCH CONFIGURATION public.email_fts
    ADD MAPPING FOR asciiword WITH english_stem;

ALTER TEXT SEARCH CONFIGURATION public.email_fts
    ADD MAPPING FOR word WITH english_stem;

ALTER TEXT SEARCH CONFIGURATION public.email_fts
    ADD MAPPING FOR numword WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.email_fts
    ADD MAPPING FOR email WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.email_fts
    ADD MAPPING FOR url WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.email_fts
    ADD MAPPING FOR host WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.email_fts
    ADD MAPPING FOR sfloat WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.email_fts
    ADD MAPPING FOR version WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.email_fts
    ADD MAPPING FOR hword_numpart WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.email_fts
    ADD MAPPING FOR hword_part WITH english_stem;

ALTER TEXT SEARCH CONFIGURATION public.email_fts
    ADD MAPPING FOR hword_asciipart WITH english_stem;

ALTER TEXT SEARCH CONFIGURATION public.email_fts
    ADD MAPPING FOR numhword WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.email_fts
    ADD MAPPING FOR asciihword WITH english_stem;

ALTER TEXT SEARCH CONFIGURATION public.email_fts
    ADD MAPPING FOR hword WITH english_stem;

ALTER TEXT SEARCH CONFIGURATION public.email_fts
    ADD MAPPING FOR url_path WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.email_fts
    ADD MAPPING FOR file WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.email_fts
    ADD MAPPING FOR "float" WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.email_fts
    ADD MAPPING FOR "int" WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.email_fts
    ADD MAPPING FOR uint WITH simple;


ALTER TEXT SEARCH CONFIGURATION public.email_fts OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_models; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_models (
    id integer NOT NULL,
    provider public.llm_provider NOT NULL,
    model_id text NOT NULL,
    display_name text NOT NULL,
    description text,
    capabilities jsonb DEFAULT '{}'::jsonb NOT NULL,
    context_length integer,
    is_embedding_model boolean DEFAULT false NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ai_models OWNER TO postgres;

--
-- Name: ai_models_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ai_models_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ai_models_id_seq OWNER TO postgres;

--
-- Name: ai_models_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ai_models_id_seq OWNED BY public.ai_models.id;


--
-- Name: ai_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_settings (
    id integer NOT NULL,
    user_id integer NOT NULL,
    selected_provider public.llm_provider DEFAULT 'openai'::public.llm_provider NOT NULL,
    selected_model_id integer,
    embedding_model_id integer,
    openai_api_key text,
    anthropic_api_key text,
    perplexity_api_key text,
    ollama_endpoint text DEFAULT 'http://localhost:11434'::text,
    confidence_threshold integer DEFAULT 70 NOT NULL,
    auto_extract_tasks boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ai_settings OWNER TO postgres;

--
-- Name: ai_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ai_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ai_settings_id_seq OWNER TO postgres;

--
-- Name: ai_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ai_settings_id_seq OWNED BY public.ai_settings.id;


--
-- Name: email_accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_accounts (
    id integer NOT NULL,
    user_id integer NOT NULL,
    account_type public.account_type NOT NULL,
    auth_method public.auth_method NOT NULL,
    email_address text NOT NULL,
    credentials jsonb NOT NULL,
    display_name text,
    server_settings jsonb,
    last_synced timestamp without time zone,
    is_active boolean DEFAULT true NOT NULL,
    sync_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.email_accounts OWNER TO postgres;

--
-- Name: email_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.email_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.email_accounts_id_seq OWNER TO postgres;

--
-- Name: email_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.email_accounts_id_seq OWNED BY public.email_accounts.id;


--
-- Name: email_semantic_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_semantic_links (
    email_id_a integer NOT NULL,
    email_id_b integer NOT NULL,
    similarity_score integer NOT NULL,
    link_type public.link_type DEFAULT 'semantic'::public.link_type NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.email_semantic_links OWNER TO postgres;

--
-- Name: emails; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.emails (
    id integer NOT NULL,
    account_id integer NOT NULL,
    message_id text NOT NULL,
    sender text NOT NULL,
    recipients text[] NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    body_html text,
    thread_id text,
    "timestamp" timestamp without time zone NOT NULL,
    processed boolean DEFAULT false NOT NULL,
    is_cleaned boolean DEFAULT false NOT NULL,
    is_rag_processed boolean DEFAULT false NOT NULL,
    metadata jsonb,
    is_read boolean DEFAULT false NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    embedding_vector text,
    ai_extracted_summary text,
    ai_suggested_tasks_json jsonb,
    ai_extracted_deadlines_json jsonb,
    ai_extracted_entities_json jsonb,
    ai_sentiment text,
    ai_suggested_category text,
    ai_processing_confidence integer,
    ai_classification_details_json jsonb,
    embedding_generated_at timestamp without time zone,
    ai_features_extracted_at timestamp without time zone,
    tasks_generated_at timestamp without time zone,
    search_vector text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.emails OWNER TO postgres;

--
-- Name: emails_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.emails_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.emails_id_seq OWNER TO postgres;

--
-- Name: emails_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.emails_id_seq OWNED BY public.emails.id;


--
-- Name: feedback; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.feedback (
    id integer NOT NULL,
    user_id integer NOT NULL,
    task_id integer,
    related_email_id integer,
    feedback_type text NOT NULL,
    source_type text,
    original_task jsonb,
    corrected_task jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.feedback OWNER TO postgres;

--
-- Name: feedback_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.feedback_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.feedback_id_seq OWNER TO postgres;

--
-- Name: feedback_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.feedback_id_seq OWNED BY public.feedback.id;


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks (
    id integer NOT NULL,
    user_id integer NOT NULL,
    email_id integer,
    title text NOT NULL,
    description text,
    detailed_description text,
    source_snippet text,
    due_date timestamp without time zone,
    priority public.priority DEFAULT 'medium'::public.priority NOT NULL,
    category public.task_category,
    actors_involved text[],
    is_completed boolean DEFAULT false NOT NULL,
    completed_at timestamp without time zone,
    estimated_effort_minutes integer,
    ai_generated boolean DEFAULT false NOT NULL,
    ai_confidence integer,
    ai_model text,
    original_ai_suggestion_json jsonb,
    needs_review boolean DEFAULT false NOT NULL,
    is_recurring_suggestion boolean DEFAULT false,
    ai_suggested_reminder_text text,
    reminder_settings_json jsonb,
    next_reminder_at timestamp without time zone,
    entities jsonb,
    embedding_vector text,
    search_vector text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.tasks OWNER TO postgres;

--
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tasks_id_seq OWNER TO postgres;

--
-- Name: tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tasks_id_seq OWNED BY public.tasks.id;


--
-- Name: user_task_interactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_task_interactions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    task_id integer NOT NULL,
    interaction_type text NOT NULL,
    previous_value_json jsonb,
    new_value_json jsonb,
    source_email_id integer,
    task_was_ai_generated boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_task_interactions OWNER TO postgres;

--
-- Name: user_task_interactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_task_interactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_task_interactions_id_seq OWNER TO postgres;

--
-- Name: user_task_interactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_task_interactions_id_seq OWNED BY public.user_task_interactions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    email text NOT NULL,
    full_name text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: ai_models id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_models ALTER COLUMN id SET DEFAULT nextval('public.ai_models_id_seq'::regclass);


--
-- Name: ai_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_settings ALTER COLUMN id SET DEFAULT nextval('public.ai_settings_id_seq'::regclass);


--
-- Name: email_accounts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_accounts ALTER COLUMN id SET DEFAULT nextval('public.email_accounts_id_seq'::regclass);


--
-- Name: emails id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emails ALTER COLUMN id SET DEFAULT nextval('public.emails_id_seq'::regclass);


--
-- Name: feedback id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedback ALTER COLUMN id SET DEFAULT nextval('public.feedback_id_seq'::regclass);


--
-- Name: tasks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);


--
-- Name: user_task_interactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_task_interactions ALTER COLUMN id SET DEFAULT nextval('public.user_task_interactions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: ai_models; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ai_models (id, provider, model_id, display_name, description, capabilities, context_length, is_embedding_model, is_default, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: ai_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ai_settings (id, user_id, selected_provider, selected_model_id, embedding_model_id, openai_api_key, anthropic_api_key, perplexity_api_key, ollama_endpoint, confidence_threshold, auto_extract_tasks, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: email_accounts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.email_accounts (id, user_id, account_type, auth_method, email_address, credentials, display_name, server_settings, last_synced, is_active, sync_enabled, created_at, updated_at) FROM stdin;
2	1	gmail	app_password	test@example.com	{"token": "c43635b620177d998672f5e5c33487a8e730bb5a6a5915c608a4098be71701b0", "password": "test-app-password-123"}	\N	\N	\N	t	t	2025-05-23 22:55:38.585131	2025-05-23 22:55:38.585131
\.


--
-- Data for Name: email_semantic_links; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.email_semantic_links (email_id_a, email_id_b, similarity_score, link_type, created_at) FROM stdin;
\.


--
-- Data for Name: emails; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.emails (id, account_id, message_id, sender, recipients, subject, body, body_html, thread_id, "timestamp", processed, is_cleaned, is_rag_processed, metadata, is_read, is_archived, embedding_vector, ai_extracted_summary, ai_suggested_tasks_json, ai_extracted_deadlines_json, ai_extracted_entities_json, ai_sentiment, ai_suggested_category, ai_processing_confidence, ai_classification_details_json, embedding_generated_at, ai_features_extracted_at, tasks_generated_at, search_vector, created_at, updated_at) FROM stdin;
1	2	test-message-1@example.com	sender1@example.com	{test@example.com}	Test Email 1	This is a test email body content for testing purposes.	\N	thread-1	2023-05-15 13:30:00	f	t	f	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-05-23 22:55:38.588359	2025-05-23 22:55:38.588359
2	2	test-message-2@example.com	sender2@example.com	{test@example.com,cc@example.com}	Important Task Due Tomorrow	Please complete the report by tomorrow EOD. This is high priority.	\N	thread-2	2023-05-16 17:20:00	f	t	f	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-05-23 22:55:38.590976	2025-05-23 22:55:38.590976
3	2	test-message-3@example.com	team@example.com	{test@example.com,team@example.com}	Weekly Team Meeting	Reminder that we have our weekly team meeting tomorrow at 10:00 AM.	\N	thread-3	2023-05-17 12:00:00	f	t	f	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-05-23 22:55:38.592376	2025-05-23 22:55:38.592376
\.


--
-- Data for Name: feedback; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.feedback (id, user_id, task_id, related_email_id, feedback_type, source_type, original_task, corrected_task, metadata, "timestamp") FROM stdin;
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tasks (id, user_id, email_id, title, description, detailed_description, source_snippet, due_date, priority, category, actors_involved, is_completed, completed_at, estimated_effort_minutes, ai_generated, ai_confidence, ai_model, original_ai_suggestion_json, needs_review, is_recurring_suggestion, ai_suggested_reminder_text, reminder_settings_json, next_reminder_at, entities, embedding_vector, search_vector, created_at, updated_at) FROM stdin;
1	1	\N	Follow up on project proposal	Send an email to the client about the project proposal status	\N	\N	2025-05-25 23:41:23.092782	high	\N	\N	f	\N	\N	f	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	2025-05-23 23:41:23.092782	2025-05-23 23:41:23.092782
2	1	\N	Review client feedback	Go through the feedback document and implement changes	\N	\N	2025-05-24 23:41:23.092782	medium	\N	\N	f	\N	\N	f	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	2025-05-23 23:41:23.092782	2025-05-23 23:41:23.092782
3	1	\N	Schedule team meeting	Set up a meeting to discuss Q2 goals	\N	\N	2025-05-28 23:41:23.092782	low	\N	\N	f	\N	\N	f	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	2025-05-23 23:41:23.092782	2025-05-23 23:41:23.092782
4	1	\N	Prepare presentation	Create slides for the upcoming conference	\N	\N	2025-05-26 23:41:23.092782	high	\N	\N	f	\N	\N	f	\N	\N	\N	t	f	\N	\N	\N	\N	\N	\N	2025-05-23 23:41:23.092782	2025-05-23 23:41:23.092782
\.


--
-- Data for Name: user_task_interactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_task_interactions (id, user_id, task_id, interaction_type, previous_value_json, new_value_json, source_email_id, task_was_ai_generated, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, password, email, full_name, created_at) FROM stdin;
1	testuser	dummy-password-for-testing	test@example.com	Test User	2025-05-23 22:47:55.662682
\.


--
-- Name: ai_models_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ai_models_id_seq', 1, false);


--
-- Name: ai_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ai_settings_id_seq', 1, false);


--
-- Name: email_accounts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.email_accounts_id_seq', 2, true);


--
-- Name: emails_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.emails_id_seq', 3, true);


--
-- Name: feedback_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.feedback_id_seq', 1, false);


--
-- Name: tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tasks_id_seq', 4, true);


--
-- Name: user_task_interactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_task_interactions_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 4, true);


--
-- Name: ai_models ai_models_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_models
    ADD CONSTRAINT ai_models_pkey PRIMARY KEY (id);


--
-- Name: ai_settings ai_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_settings
    ADD CONSTRAINT ai_settings_pkey PRIMARY KEY (id);


--
-- Name: email_accounts email_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_accounts
    ADD CONSTRAINT email_accounts_pkey PRIMARY KEY (id);


--
-- Name: emails emails_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_pkey PRIMARY KEY (id);


--
-- Name: feedback feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: user_task_interactions user_task_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_task_interactions
    ADD CONSTRAINT user_task_interactions_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: account_message_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX account_message_id_idx ON public.emails USING btree (account_id, message_id);


--
-- Name: email_a_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX email_a_idx ON public.email_semantic_links USING btree (email_id_a);


--
-- Name: email_b_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX email_b_idx ON public.email_semantic_links USING btree (email_id_b);


--
-- Name: email_semantic_links_pk_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX email_semantic_links_pk_idx ON public.email_semantic_links USING btree (email_id_a, email_id_b);


--
-- Name: ai_settings ai_settings_embedding_model_id_ai_models_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_settings
    ADD CONSTRAINT ai_settings_embedding_model_id_ai_models_id_fk FOREIGN KEY (embedding_model_id) REFERENCES public.ai_models(id);


--
-- Name: ai_settings ai_settings_selected_model_id_ai_models_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_settings
    ADD CONSTRAINT ai_settings_selected_model_id_ai_models_id_fk FOREIGN KEY (selected_model_id) REFERENCES public.ai_models(id);


--
-- Name: ai_settings ai_settings_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_settings
    ADD CONSTRAINT ai_settings_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: email_accounts email_accounts_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_accounts
    ADD CONSTRAINT email_accounts_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: email_semantic_links email_semantic_links_email_id_a_emails_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_semantic_links
    ADD CONSTRAINT email_semantic_links_email_id_a_emails_id_fk FOREIGN KEY (email_id_a) REFERENCES public.emails(id);


--
-- Name: email_semantic_links email_semantic_links_email_id_b_emails_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_semantic_links
    ADD CONSTRAINT email_semantic_links_email_id_b_emails_id_fk FOREIGN KEY (email_id_b) REFERENCES public.emails(id);


--
-- Name: emails emails_account_id_email_accounts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_account_id_email_accounts_id_fk FOREIGN KEY (account_id) REFERENCES public.email_accounts(id);


--
-- Name: feedback feedback_related_email_id_emails_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_related_email_id_emails_id_fk FOREIGN KEY (related_email_id) REFERENCES public.emails(id);


--
-- Name: feedback feedback_task_id_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_task_id_tasks_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id);


--
-- Name: feedback feedback_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: tasks tasks_email_id_emails_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_email_id_emails_id_fk FOREIGN KEY (email_id) REFERENCES public.emails(id);


--
-- Name: tasks tasks_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_task_interactions user_task_interactions_source_email_id_emails_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_task_interactions
    ADD CONSTRAINT user_task_interactions_source_email_id_emails_id_fk FOREIGN KEY (source_email_id) REFERENCES public.emails(id);


--
-- Name: user_task_interactions user_task_interactions_task_id_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_task_interactions
    ADD CONSTRAINT user_task_interactions_task_id_tasks_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id);


--
-- Name: user_task_interactions user_task_interactions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_task_interactions
    ADD CONSTRAINT user_task_interactions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: yasseralmohammed
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO PUBLIC;


--
-- PostgreSQL database dump complete
--

