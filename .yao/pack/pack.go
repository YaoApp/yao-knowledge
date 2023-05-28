package pack

/**
 * The application source code protected
 */

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"io"
)

// Pack the yao app package
type Pack struct{ key string }

// Cipher the cipher
// ** Do not change this variable name **
var Cipher *Pack

// SetCipher set the cipher
// ** Do not change this function name **
func SetCipher(license string) {
	Cipher = &Pack{key: license}
}

// Encrypt encrypts a byte slice.
// ** Do not change this function name **
func (pack *Pack) Encrypt(reader io.Reader, writer io.Writer) error {

	// ****************************************************************
	// Replace the following code with your own implementation
	// ****************************************************************

	const blockSize = aes.BlockSize
	key := make([]byte, blockSize)
	copy(key, pack.key)

	var iv [blockSize]byte
	block, err := aes.NewCipher(key)
	if err != nil {
		return err
	}

	stream := cipher.NewCFBEncrypter(block, iv[:])
	buf := make([]byte, 4096)
	for {
		n, err := reader.Read(buf)
		if err != nil && err != io.EOF {
			return err
		}
		if n == 0 {
			break
		}
		stream.XORKeyStream(buf[:n], buf[:n])
		if _, err := writer.Write(buf[:n]); err != nil {
			return err
		}
	}

	return nil
}

// Decrypt decrypts a byte slice.
// ** Do not change this function name **
func (pack *Pack) Decrypt(reader io.Reader, writer io.Writer) error {

	// ****************************************************************
	// Replace the following code with your own implementation
	// ****************************************************************

	const blockSize = aes.BlockSize
	key := make([]byte, blockSize)
	copy(key, pack.key)

	var iv [blockSize]byte
	block, err := aes.NewCipher(key)
	if err != nil {
		return err
	}

	stream := cipher.NewCFBDecrypter(block, iv[:])
	buf := make([]byte, 4096)

	for {
		n, err := reader.Read(buf)
		if err != nil && err != io.EOF {
			return err
		}
		if n == 0 {
			break
		}
		stream.XORKeyStream(buf[:n], buf[:n])
		if _, err := writer.Write(buf[:n]); err != nil {
			return err
		}
	}
	return nil
}

// padding
func (pack *Pack) pkcs5Padding(ciphertext []byte, blockSize int) []byte {
	padding := blockSize - len(ciphertext)%blockSize
	padtext := bytes.Repeat([]byte{byte(padding)}, padding)
	return append(ciphertext, padtext...)
}

// unpading
func (pack *Pack) pkcs5UnPadding(origData []byte) []byte {
	length := len(origData)
	unpadding := int(origData[length-1])
	return origData[:(length - unpadding)]
}
