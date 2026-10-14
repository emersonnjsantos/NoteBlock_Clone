#include <windows.h>
#include <shellapi.h>
#include <stdio.h>

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    char exeDir[MAX_PATH];
    GetModuleFileNameA(NULL, exeDir, MAX_PATH);
    char *lastSlash = strrchr(exeDir, '\\');
    if (lastSlash) {
        *lastSlash = '\0';
    }

    char targetExe[MAX_PATH];
    snprintf(targetExe, sizeof(targetExe), "%s\\build\\Bloco de Notas-win32-x64\\Bloco de Notas.exe", exeDir);

    char workDir[MAX_PATH];
    snprintf(workDir, sizeof(workDir), "%s\\build\\Bloco de Notas-win32-x64", exeDir);

    HINSTANCE res = ShellExecuteA(NULL, "open", targetExe, lpCmdLine, workDir, SW_SHOWNORMAL);
    if ((INT_PTR)res <= 32) {
        char msg[512];
        snprintf(msg, sizeof(msg), "Não foi possível iniciar o executável em:\n%s", targetExe);
        MessageBoxA(NULL, msg, "Bloco de Notas - Erro", MB_ICONERROR | MB_OK);
        return 1;
    }
    return 0;
}
