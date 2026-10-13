-- Dynamic Form Builder - MySQL 8.0 schema (generated from SQLAlchemy models)
-- Alternative to `alembic upgrade head`. Roles + default admin are seeded by the API on startup.
CREATE DATABASE IF NOT EXISTS formbuilder CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE formbuilder;
SET FOREIGN_KEY_CHECKS=0;

CREATE TABLE roles (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	name VARCHAR(30) NOT NULL, 
	CONSTRAINT pk_roles PRIMARY KEY (id), 
	CONSTRAINT uq_roles_name UNIQUE (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE users (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	name VARCHAR(120) NOT NULL, 
	email VARCHAR(255) NOT NULL, 
	password_hash VARCHAR(255) NOT NULL, 
	role_id INTEGER NOT NULL, 
	is_active BOOL NOT NULL, 
	created_at DATETIME NOT NULL, 
	CONSTRAINT pk_users PRIMARY KEY (id), 
	CONSTRAINT fk_users_role_id_roles FOREIGN KEY(role_id) REFERENCES roles (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE TABLE activity_logs (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	user_id INTEGER, 
	form_id INTEGER, 
	action VARCHAR(60) NOT NULL, 
	entity_type VARCHAR(30), 
	entity_id INTEGER, 
	details JSON, 
	ip_address VARCHAR(45), 
	created_at DATETIME NOT NULL, 
	CONSTRAINT pk_activity_logs PRIMARY KEY (id), 
	CONSTRAINT fk_activity_logs_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX ix_activity_logs_action ON activity_logs (action);
CREATE INDEX ix_activity_logs_created_at ON activity_logs (created_at);
CREATE INDEX ix_activity_logs_entity ON activity_logs (entity_type, entity_id);
CREATE INDEX ix_activity_logs_form_id ON activity_logs (form_id);
CREATE INDEX ix_activity_logs_user_id ON activity_logs (user_id);

CREATE TABLE forms (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	title VARCHAR(255) NOT NULL, 
	description TEXT, 
	owner_id INTEGER NOT NULL, 
	is_active BOOL NOT NULL, 
	is_public BOOL NOT NULL, 
	allow_response_edit BOOL NOT NULL, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	CONSTRAINT pk_forms PRIMARY KEY (id), 
	CONSTRAINT fk_forms_owner_id_users FOREIGN KEY(owner_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX ix_forms_owner_id ON forms (owner_id);

CREATE TABLE form_fields (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	form_id INTEGER NOT NULL, 
	field_key VARCHAR(64) NOT NULL, 
	label VARCHAR(255) NOT NULL, 
	field_type VARCHAR(20) NOT NULL, 
	is_required BOOL NOT NULL, 
	placeholder VARCHAR(255), 
	position INTEGER NOT NULL, 
	validation JSON, 
	`condition` JSON, 
	CONSTRAINT pk_form_fields PRIMARY KEY (id), 
	CONSTRAINT uq_form_fields_form_id UNIQUE (form_id, field_key), 
	CONSTRAINT fk_form_fields_form_id_forms FOREIGN KEY(form_id) REFERENCES forms (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX ix_form_fields_form_id ON form_fields (form_id);

CREATE TABLE form_responses (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	form_id INTEGER NOT NULL, 
	user_id INTEGER, 
	submitted_at DATETIME NOT NULL, 
	updated_at DATETIME, 
	CONSTRAINT pk_form_responses PRIMARY KEY (id), 
	CONSTRAINT fk_form_responses_form_id_forms FOREIGN KEY(form_id) REFERENCES forms (id) ON DELETE CASCADE, 
	CONSTRAINT fk_form_responses_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX ix_form_responses_form_id ON form_responses (form_id);
CREATE INDEX ix_form_responses_submitted_at ON form_responses (submitted_at);
CREATE INDEX ix_form_responses_user_id ON form_responses (user_id);

CREATE TABLE field_options (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	field_id INTEGER NOT NULL, 
	label VARCHAR(255) NOT NULL, 
	value VARCHAR(255) NOT NULL, 
	position INTEGER NOT NULL, 
	CONSTRAINT pk_field_options PRIMARY KEY (id), 
	CONSTRAINT fk_field_options_field_id_form_fields FOREIGN KEY(field_id) REFERENCES form_fields (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX ix_field_options_field_id ON field_options (field_id);

CREATE TABLE response_details (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	response_id INTEGER NOT NULL, 
	field_id INTEGER NOT NULL, 
	value TEXT, 
	CONSTRAINT pk_response_details PRIMARY KEY (id), 
	CONSTRAINT uq_response_details_response_id UNIQUE (response_id, field_id), 
	CONSTRAINT fk_response_details_response_id_form_responses FOREIGN KEY(response_id) REFERENCES form_responses (id) ON DELETE CASCADE, 
	CONSTRAINT fk_response_details_field_id_form_fields FOREIGN KEY(field_id) REFERENCES form_fields (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX ix_response_details_field_id ON response_details (field_id);
CREATE INDEX ix_response_details_response_id ON response_details (response_id);

SET FOREIGN_KEY_CHECKS=1;
INSERT IGNORE INTO roles (id, name) VALUES (1,'Admin'),(2,'User');
