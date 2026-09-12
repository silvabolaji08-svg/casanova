/**
 * Demo accounts.
 *
 * Passwords are plaintext here and hashed by the pre('save') hook when the
 * seed creates them. This file is committed, so these are demo credentials
 * and nothing else — never a real password.
 */

export const demoUsers = [
  {
    name: 'Store Admin',
    email: 'admin@casanova.homes',
    password: 'admin1234',
    role: 'admin',
  },

  /* Three agents with deliberately different diaries, so availability
     actually differs between properties instead of every listing offering
     the same slots. */
  {
    name: 'Amara Okonkwo',
    email: 'amara@casanova.homes',
    password: 'agent1234',
    role: 'agent',
    phone: '020 7946 0102',
    agency: 'Casanova North',
    bio: 'Fifteen years across Camden, Islington and Hackney. Specialises in period conversions and warehouse flats.',
    workingDays: [1, 2, 3, 4, 5],
    workingHours: { start: '09:00', end: '18:00' },
    slotMinutes: 30,
  },
  {
    name: 'Tom Whitfield',
    email: 'tom@casanova.homes',
    password: 'agent1234',
    role: 'agent',
    phone: '020 7946 0187',
    agency: 'Casanova West',
    bio: 'Kensington, Chelsea and Notting Hill. Handles the higher end of the sales book.',
    /* Works Tuesday to Saturday, hour-long viewings — so this agent's
       calendar looks nothing like Amara's. */
    workingDays: [2, 3, 4, 5, 6],
    workingHours: { start: '10:00', end: '17:00' },
    slotMinutes: 60,
  },
  {
    name: 'Priya Raman',
    email: 'priya@casanova.homes',
    password: 'agent1234',
    role: 'agent',
    phone: '020 7946 0245',
    agency: 'Casanova South',
    bio: 'South of the river — Clapham, Brixton, Peckham and Greenwich. Mostly lettings.',
    workingDays: [1, 2, 3, 4, 5, 6],
    workingHours: { start: '08:30', end: '19:00' },
    slotMinutes: 30,
  },

  /* Buyers. */
  {
    name: 'Mobolaji Silva',
    email: 'demo@casanova.homes',
    password: 'demo1234',
    role: 'buyer',
    phone: '07700 900123',
  },
  {
    name: 'Sarah Chen',
    email: 'sarah@example.com',
    password: 'demo1234',
    role: 'buyer',
    phone: '07700 900456',
  },
]