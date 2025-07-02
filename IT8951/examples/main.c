#include "../lib/Config/DEV_Config.h"
#include "example.h"
#include "../lib/GUI/GUI_BMPfile.h"

#include <math.h>

#include <stdlib.h>     //exit()
#include <signal.h>     //signal()

#define Enhance false

#define USE_Factory_Test false

#define USE_Normal_Demo true

#define USE_Touch_Panel false

UWORD VCOM = 2510;

IT8951_Dev_Info Dev_Info = {0, 0};
UWORD Panel_Width;
UWORD Panel_Height;
UDOUBLE Init_Target_Memory_Addr;
int epd_mode = 0;	//0: no rotate, no mirror
					//1: no rotate, horizontal mirror, for 10.3inch
					//2: no totate, horizontal mirror, for 5.17inch
					//3: no rotate, no mirror, isColor, for 6inch color
					
void  Handler(int signo){
    Debug("\r\nHandler:exit\r\n");
    if(Refresh_Frame_Buf != NULL){
        free(Refresh_Frame_Buf);
        Debug("free Refresh_Frame_Buf\r\n");
        Refresh_Frame_Buf = NULL;
    }
    if(Panel_Frame_Buf != NULL){
        free(Panel_Frame_Buf);
        Debug("free Panel_Frame_Buf\r\n");
        Panel_Frame_Buf = NULL;
    }
    if(Panel_Area_Frame_Buf != NULL){
        free(Panel_Area_Frame_Buf);
        Debug("free Panel_Area_Frame_Buf\r\n");
        Panel_Area_Frame_Buf = NULL;
    }
    if(bmp_src_buf != NULL){
        free(bmp_src_buf);
        Debug("free bmp_src_buf\r\n");
        bmp_src_buf = NULL;
    }
    if(bmp_dst_buf != NULL){
        free(bmp_dst_buf);
        Debug("free bmp_dst_buf\r\n");
        bmp_dst_buf = NULL;
    }
	if(Dev_Info.Panel_W != 0){
		Debug("Going to sleep\r\n");
		EPD_IT8951_Sleep();
	}
    DEV_Module_Exit();
    exit(0);
}


int main(int argc, char *argv[])
{
    //Exception handling:ctrl + c
    signal(SIGINT, Handler);

    if (argc < 2){
        Debug("Please input VCOM value on FPC cable!\r\n");
        Debug("Example: sudo ./epd -2.51\r\n");
        exit(1);
    }
    if (argc != 3){
        Debug("Please input e-Paper display mode!\r\n");
        Debug("Example: sudo ./epd -2.51 0 or sudo ./epd -2.51 1\r\n");
        Debug("Now, 10.3 inch glass panle is mode1, else is mode0\r\n");
        Debug("If you don't know what to type in just type 0 \r\n");
        exit(1);
    }

    //Init the BCM2835 Device
    if(DEV_Module_Init()!=0){
        return -1;
    }

    double temp;
    sscanf(argv[1],"%lf",&temp);
    VCOM = (UWORD)(fabs(temp)*1000);
    Debug("VCOM value:%d\r\n", VCOM);
    sscanf(argv[2],"%d",&epd_mode);
    Debug("Display mode:%d\r\n", epd_mode);
    Dev_Info = EPD_IT8951_Init(VCOM);

    //get some important info from Dev_Info structure
    Panel_Width = Dev_Info.Panel_W;
    Panel_Height = Dev_Info.Panel_H;
    Init_Target_Memory_Addr = Dev_Info.Memory_Addr_L | (Dev_Info.Memory_Addr_H << 16);
    char* LUT_Version = (char*)Dev_Info.LUT_Version;
    if( strcmp(LUT_Version, "M641") == 0 ){
        A2_Mode = 4;
        Four_Byte_Align = true;
    }else if( strcmp(LUT_Version, "M841_TFAB512") == 0 ){
        A2_Mode = 6;
        Four_Byte_Align = true;
    }else if( strcmp(LUT_Version, "M841") == 0 ){
        A2_Mode = 6;
    }else if( strcmp(LUT_Version, "M841_TFA2812") == 0 ){
        A2_Mode = 6;
    }else if( strcmp(LUT_Version, "M841_TFA5210") == 0 ){
        A2_Mode = 6;
    }else{
        A2_Mode = 6;
    }
    Debug("A2 Mode:%d\r\n", A2_Mode);

    EPD_IT8951_Clear_Refresh(Dev_Info, Init_Target_Memory_Addr, INIT_Mode);

    // Display screenshot.bmp
    // EPD_IT8951_Clear_Refresh(Dev_Info, Init_Target_Memory_Addr, GC16_Mode);

    //We recommended refresh the panel to white color before storing in the warehouse.
    EPD_IT8951_Clear_Refresh(Dev_Info, Init_Target_Memory_Addr, INIT_Mode);
    Display_BMP_Example(Panel_Width, Panel_Height, Init_Target_Memory_Addr, BitsPerPixel_4);

    EPD_IT8951_Sleep();

    //In case RPI is transmitting image in no hold mode, which requires at most 10s
    DEV_Delay_ms(5000);

    DEV_Module_Exit();
    return 0;
}
