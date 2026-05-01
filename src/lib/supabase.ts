import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://swrpjlcnkrkzbwrmezwf.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3cnBqbGNua3JremJ3cm1lendmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NTA3ODAsImV4cCI6MjA5MzEyNjc4MH0.SLf1LNn2NLmo8l0mldUBukiMnGLR7e_hgdN7X4AwDe0'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
