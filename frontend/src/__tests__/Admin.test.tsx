import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Admin } from '../pages/Admin';
import { api } from '../services/api';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock API
vi.mock('../services/api', () => ({
    api: {
        admin: {
            listUsers: vi.fn(),
            createUser: vi.fn(),
            deleteUser: vi.fn(),
        },
        getStats: vi.fn()
    }
}));

const MockAdmin = () => (
    <MemoryRouter>
        <Admin />
    </MemoryRouter>
);

describe('Admin Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock localStorage
        const adminUser = { id: 1, nome: 'Admin', role: 'admin' };
        Storage.prototype.getItem = vi.fn(() => JSON.stringify(adminUser));
    });

    it('renders loading state initially', async () => {
        (api.admin.listUsers as any).mockImplementation(() => new Promise(() => { }));
        (api.getStats as any).mockImplementation(() => new Promise(() => { }));

        render(<MockAdmin />);
        expect(screen.getByText(/carregando/i)).toBeInTheDocument();
    });

    it('renders user list after loading', async () => {
        const mockUsers = [
            { id: 1, nome: 'Admin User', email: 'admin@test.com', role: 'admin' },
            { id: 2, nome: 'Prof User', email: 'prof@test.com', role: 'professor' }
        ];

        (api.admin.listUsers as any).mockResolvedValue(mockUsers);
        (api.getStats as any).mockResolvedValue({});

        await act(async () => {
            render(<MockAdmin />);
        });

        screen.debug(); // Inspect output

        await waitFor(() => {
            expect(screen.getByText('Admin User')).toBeInTheDocument();
            expect(screen.getByText('Prof User')).toBeInTheDocument();
        });
    });

    it('opens new user modal when button is clicked', async () => {
        (api.admin.listUsers as any).mockResolvedValue([]);
        (api.getStats as any).mockResolvedValue({});

        await act(async () => {
            render(<MockAdmin />);
        });

        await waitFor(() => {
            expect(screen.queryByText(/carregando/i)).not.toBeInTheDocument();
        });

        const addButton = screen.getByText(/novo usuário/i);
        fireEvent.click(addButton);

        expect(screen.getByText(/novo professor/i)).toBeInTheDocument();
    });
});
