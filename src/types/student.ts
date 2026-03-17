export type Student = {
  id: number
  name: string
  guardian: string
  age: number
  school: string
  academy_class: string
  school_class: string
  shoe_size: string
  tee_size: string
  comment: string
}

export type StudentCreateInput = Omit<Student, 'id'>

export type StudentUpdateInput = Partial<StudentCreateInput>

