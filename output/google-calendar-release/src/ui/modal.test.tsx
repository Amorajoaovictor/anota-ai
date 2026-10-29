import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { Modal } from './modal'

function EditingDialog() {
  const [name, setName] = useState('')
  const [open, setOpen] = useState(true)
  return open && <Modal title="Editar projeto" onClose={() => setOpen(false)}>
    <label>Nome<input value={name} onChange={(event) => setName(event.target.value)} /></label>
  </Modal>
}

describe('Modal', () => {
  /**
   * Protege: campo mantém foco durante digitação em formulário controlado.
   * Regressão real: onClose novo a cada render reinicia efeito e move foco ao botão de fechar.
   * Impacto: usuário precisa clicar no campo após cada caractere ao editar projeto.
   */
  it('mantém foco no campo após digitar com onClose recriado', async () => {
    render(<EditingDialog />)
    const input = await screen.findByRole('textbox', { name: 'Nome' })
    await userEvent.click(input)
    await userEvent.type(input, 'Projeto')
    expect(input).toHaveValue('Projeto')
    expect(input).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Editar projeto' })).not.toBeInTheDocument()
  })
})
