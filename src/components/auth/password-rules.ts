// Mirrors supabase/config.toml: minimum_password_length = 8, password_requirements = "letters_digits".
export const PASSWORD_HINT = "At least 8 characters, with letters and numbers.";

export const isStrongEnough = (password: string) =>
  password.length >= 8 && /[a-z]/i.test(password) && /\d/.test(password);
