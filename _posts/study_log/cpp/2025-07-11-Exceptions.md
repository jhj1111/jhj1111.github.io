---
title: (C++)11. 예외 처리
post_order: 11
thumbnail: https://codingnuri.com/golang-book/assets/function.png
layout: post
author: jhj
categories:
  - StudyLog
  - Cpp
tags:
  - Programming
  - Language
  - C++
excerpt: raise, try, catch를 통한 예외 처리 방식
project_rank: "600"
sticker: emoji//1f4aa
---
# throw, try, catch
> 예외 발생 사실을 명시적으로 나타낸다.
> 예외 발생 시 예외 처리 부분으로 이동(jump)한다.

- stack unwinding : throw를 통해 함수를 빠져 나갈 때 stack에 존재하는 모든 객체 소멸
	- 단 **생성자**에서 **예외**가 발생 시 소멸자 호출되지 않음
- `try` 구문에서 오류 발생 시 `catch` 에서 해당 오류를 찾음
- `throw error_obj("error message")` : 예외로 전달하고 싶은 **객체**와 **메세지**를 전달
	- `e.what()` : 에러 메세지 출력
	- 이 때 std의 에러 객체 뿐 아니라 data type을 받는 것도 가능
- `catch(...)` : 발생한 모든 예외 처리

```cpp
int func3() {
  Resource r(3);
  throw std::runtime_error("Exception from 3!\n");
}

int main() {
  try {
    func1();
  } catch (std::exception& e) {
    std::cout << "Exception : " << e.what();
  }
}
```

---

```cpp
#include <iostream>
#include <string>

int func(int c) {
  if (c == 1) {
    throw 10;
  } else if (c == 2) {
    throw std::string("hi!");
  } else if (c == 3) {
    throw 'a';
  } else if (c == 4) {
    throw "hello!";
  }
  return 0;
}

int main() {
  int c;
  std::cin >> c;

  try {
    func(c);
  } catch (char x) {
    std::cout << "Char : " << x << std::endl;
  } catch (int x) {
    std::cout << "Int : " << x << std::endl;
  } catch (std::string& s) {
    std::cout << "String : " << s << std::endl;
  } catch (const char* s) {
    std::cout << "String Literal : " << s << std::endl;
  } catch (...) {
    std::cout << "Default Exeption" << std::endl;
  }
  
}
```

- `catch`에서 오류 검색은 순차적으로 이루어짐
	- 상속 관계의 class가 에러를 받을 시 subclass가 상위로 와야 함

```cpp
#include <exception>
#include <iostream>

class Parent : public std::exception {
 public:
  virtual const char* what() const noexcept override { return "Parent!\n"; }
};

class Child : public Parent {
 public:
  const char* what() const noexcept override { return "Child!\n"; }
};

int func(int c) {
  throw Child();
}

int main() {
  int c;
  std::cin >> c;

  try {
    func(c);			// Parent Catch
  } catch (Parent& p) {
    std::cout << "Parent Catch!" << std::endl;
    std::cout << p.what();
  } catch (Child& c) {
    std::cout << "Child Catch!" << std::endl;
    std::cout << c.what();
  }
}
```

---

```cpp
  try {
    func(c);			// Child Catch
  } catch (Child& c) {
    std::cout << "Child Catch!" << std::endl;
    std::cout << c.what();
  } catch (Parent& p) {
    std::cout << "Parent Catch!" << std::endl;
    std::cout << p.what();
  }
}
```

# noexcept
> 함수가 예외가 없다고 명시한다.
> 단 컴파일러에게 예외가 없다고 알릴 뿐 발생하지 않는 것은 아니다.

- 예외를 발생시키지 않는다고 명시하여 최적화 실행
	- **이동 생성**에서의 noexcept 등(레퍼런스 파트 참고)

```cpp
...

MyString::MyString(MyString &&str) noexcept{
  std::cout << "이동 생성자 호출 !" << std::endl;
  string_length = str.string_length;
  string_content = str.string_content;
  memory_capacity = str.memory_capacity;

  // 임시 객체 소멸 시에 메모리를 해제하지
  // 못하게 한다.
  str.string_content = nullptr;
}
MyString::~MyString() {
  if (string_content) delete[] string_content;
}

int main() {
  MyString s("abc");
  std::vector<MyString> vec;
  vec.resize(0);

  std::cout << "첫 번째 추가 ---" << std::endl;
  vec.push_back(s);
  std::cout << "두 번째 추가 ---" << std::endl;
  vec.push_back(s);
  std::cout << "세 번째 추가 ---" << std::endl;
  vec.push_back(s);
}
```


| 예외클래스             | 언제 던져지는가                                                                                                                                                                                                                            | 해당 예외의 헤더파일 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| bad_alloc         | new/new[]연산자로 동적메모리 할당에 실패하는 경우  <br>예를들어 컴퓨터에 메모리 자원이 부족한 경우                                                                                                                                                                       | new         |
| bad_cast          | dynamic_cast연산에서 캐스팅이 실패하는 경우  <br>예를들어 부모객체를 자식클래스에 캐스팅 시도하는 경우                                                                                                                                                                    | typeinfo    |
| bad_typeid        | typeid연산자가 null포인터를 반환하는 경우  <br>예를들어 typeid(특정nullptr변수).name()처럼 사용하는 경우                                                                                                                                                          |             |
| bad_exception     | void func() throw (int, char) {} 처럼 작성된 함수에서  <br> int나 char가 아닌 string예외가 발생하는 경우                                                                                                                                                  | exeption    |
| length_error      | 최대 허용 길이를 초과하는 객체를 만들려 할 때  <br>예를 들어 vector<int> my_vector;를 만들고  <br>my_vector.resize(my_vector.max_size()+1); 처럼 사용하는 경우                                                                                                         | stdexcept   |
| domain_error      | 수학적인 도메인 에러를 탐지할때(결과가 존재하지 않는 인자)  <br>예를들어 루트 안에 음수값이 들어간 경우                                                                                                                                                                       |             |
| out_of_range      | 배열 범위 검사에서 인자가 index 범위를 초과할때  <br>예를들어 string str = "abc";를 만들고  <br> str.at(10);처럼 사용 시 at멤버가 던짐                                                                                                                                  |             |
| invalid_argument  | 함수 인자의 값이 유효하지 않을때  <br>예를 들어 char 자료형은 0~255를 보관할 수 있는데  <br>여기에 256을 넣으려고 할때                                                                                                                                                      |             |
| overflow_error    | 산술 계산에서 상한값을 초과할 때  <br>예를 들어 아주아주 작은 값으로 나눌 때                                                                                                                                                                                      |             |
| underflow_error   | 산술 계산에서 하한값을 초과할 때  <br>예를들어 아주아주 큰 값으로 나눌 때                                                                                                                                                                                        |             |
| range_error       | 계산에서 부동 소수점 값이 너무 크거나 작아서 표현할 수 없을 때  <br> 표준 라이브러리의 수학함수들은 이 예외를 발생시키지 않음                                                                                                                                                          |             |
| bad_function_call | 함수 포인터를 이용해 함수를 호출했는데 해당 포인터값이 nullptr인 경우                                                                                                                                                                                          |             |
| bad_weak_ptr      | 만료된 weak_ptr로 생성된 경우  <br>shared_ptr의 생성자에 의해 예외 발생  <br>  <br>  <br>예를들어 shared_ptr<int> sp(new int(10)); 처럼 만든 후  <br>weak_ptr<int> wp(sp);처럼 weak_ptr을 만들고  <br>p.reset();함수를 사용하면 weak_ptr은 소멸되는데   <br>이 후 wp변수를 사용하는 경우 예외 발생 |             |