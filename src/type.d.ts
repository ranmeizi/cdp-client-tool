type SendMessageType<T = any> = {
    payload: T
}

type ReturnMessageType<T = any> = {
    code: string,
    payload: T,
    message: string
}