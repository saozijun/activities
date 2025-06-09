/**
 * 日期格式化
 * @param time // 时间
 * @param pattern // 时间格式
 * @returns 
 */
export function parseTime(time: any, pattern?: string): string | null {
    if (arguments.length === 0 || !time) {
        return null;
    }
    const format = pattern || "{y}-{m}-{d} {h}:{i}:{s}";
    let date: Date;

    if (typeof time === "object") {
        date = time as Date;
    } else {
        if (typeof time === "string" && /^[0-9]+$/.test(time)) {
            time = parseInt(time);
        } else if (typeof time === "string") {
            time = time.replace(/-/g, "/").replace("T", " ").replace(/\.[\d]{3}/g, "");
        }
        if (typeof time === "number" && time.toString().length === 10) {
            time = time * 1000;
        }
        date = new Date(time);
    }

    const formatObj: { [key: string]: number } = {
        y: date.getFullYear(),
        m: date.getMonth() + 1,
        d: date.getDate(),
        h: date.getHours(),
        i: date.getMinutes(),
        s: date.getSeconds(),
        a: date.getDay(),
    };

    const time_str = format.replace(/{(y|m|d|h|i|s|a)+}/g, (result, key) => {
        // 明确指定 key 的类型为已知的字符串类型
        const value = formatObj[key as keyof typeof formatObj];
        
        // Note: getDay() returns 0 on Sunday
        if (key === "a") {
            return ["日", "一", "二", "三", "四", "五", "六"][value];
        }
        if (result.length > 0 && value < 10) {
            return "0" + value;
        }
        return value.toString();
    });

    return time_str;
}