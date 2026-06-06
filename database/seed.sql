INSERT INTO roles (name)
VALUES ('user'), ('manager'), ('admin')
ON CONFLICT (name) DO NOTHING;

INSERT INTO car_makes (name)
VALUES ('Toyota'), ('BMW'), ('Mercedes-Benz'), ('Hyundai')
ON CONFLICT (name) DO NOTHING;

INSERT INTO body_types (name)
VALUES ('Седан'), ('Хэтчбек'), ('Универсал'), ('Кроссовер'), ('Внедорожник')
ON CONFLICT (name) DO NOTHING;
