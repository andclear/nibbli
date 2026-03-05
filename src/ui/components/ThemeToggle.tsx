import { Moon, Sun, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAppStore } from '@/store/useAppStore';

export function ThemeToggle() {
    const { colorMode, setColorMode } = useAppStore();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Sun className="h-[1.1rem] w-[1.1rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-[1.1rem] w-[1.1rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">切换主题</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setColorMode('light')} className="flex items-center gap-2">
                    <Check className={`h-4 w-4 ${colorMode === 'light' ? 'opacity-100' : 'opacity-0'}`} />
                    亮色主题
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setColorMode('dark')} className="flex items-center gap-2">
                    <Check className={`h-4 w-4 ${colorMode === 'dark' ? 'opacity-100' : 'opacity-0'}`} />
                    暗色主题
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setColorMode('system')} className="flex items-center gap-2">
                    <Check className={`h-4 w-4 ${colorMode === 'system' ? 'opacity-100' : 'opacity-0'}`} />
                    跟随系统
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
