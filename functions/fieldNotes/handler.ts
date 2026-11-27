import { lambdaAdapter } from '../shared/adapter'
import { authenticateUser } from '../shared/middleware/validateToken'
import { getFieldNote, saveFieldNote } from '../shared/controllers/fieldNoteController'

export const getNote = lambdaAdapter(getFieldNote, [authenticateUser], false)
export const saveNote = lambdaAdapter(saveFieldNote, [authenticateUser], false)