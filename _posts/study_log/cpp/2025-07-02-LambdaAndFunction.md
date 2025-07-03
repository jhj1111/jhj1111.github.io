---
title: (C++)10. 람다(lambda) 함수와 callable
post_order: 10
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
excerpt: 람다와 callable 함수
project_rank: "600"
sticker: emoji//1f4aa
---
# Lambda
> 함수의 **선언(declation)을 생략**하는 함수형 프로그래밍 기능이다.
> 함수형 언어의 특징이지만 많은 언어가 지원하며, c++역시 지원한다.
> **변수** 또는 **객체의 전달이 가능**하나, 이 경우 **변수의 lifetime** 및 **scope**에 **주의**해야 한다.

![](/assets/images/study_log/cpp/2025-07-02-LambdaAndFunction/lambda_declation.png)

`[my_mod](int v_) -> int { return v_ % my_mod; }`

- `[capture]` : 외부 변수의 참조 여부
	- `[=]() { /* */ }` : call-by-value
		- **const 형태**로 불러와 <span style="color:rgb(255, 0, 0)">수정이 불가</span>
		- **mutable** 인자를 통해 **수정 가능**
	- `[&]() { /* */ }` : call-by-referrence
	- lambda 블록 바깥의 변수를 가져옴
	- 변수 및 reference 가능
	- scope은 <span style="color:rgb(255, 0, 0)">정의(definition) 구간을 기준</span>으로 형성되나, **lifetime에 주의**해야 함(reference 참조)
- `(parameters)` : 함수 인자 정의
	- 여러개 정의 가능
	- 생략 가능
- `-> type` : **return** type
	- 생략 가능
- `{statement}` : 함수 구현 부분
- **closure** 가능

- 선언 예시

```cpp
auto f = [=, &y]() { return x + y; };
auto f = [=, &y] { return x + y; };

int z = 5;
auto f = [z]() mutable { z++; return z; };
auto f = [z]() { z++; return z; };	// error

auto f = [](int a, int b) { return a * b; };	// type 추론 compile-time
auto f = [](int a, int b) -> int { return a * b; };
f(1,2)

auto f = [x = 42]() { return x; };

auto f = [v = std::vector<int>{1, 2, 3}]() {
    return v.size();
};
```

---

```cpp
#include <iostream>

int main() {
    int x = 10;
    auto by_value = [=]() { std::cout << x << "\n"; };
    auto by_ref = [&]() { std::cout << x << "\n"; };

    x = 20;
    by_value(); // 10 (정의 시점의 값 복사)
    by_ref();   // 20 (정의 시점의 참조 → 현재 값)
}
```

---

```cpp
std::function<void()> f;
{
    int y = 5;
    f = [&]() { std::cout << y << "\n"; };  // y의 참조를 캡처
} // y 소멸

f(); // ⚠️ Undefined Behavior! dangling reference
```

# Callable
> `operator ()`을 통해 실행 가능한 함수.
> 반드시 함수일 필요는 없다.

```cpp
#include <iostream>

struct S {
  void operator()(int a, int b) { std::cout << "a + b = " << a + b << std::endl; }
};

int main() {
  S some_obj;

  some_obj(3, 5);
}
```

## std::function
> callable을 객체의 형태로 보관 가능하게 만들어주는 메소드.

- `std::function<T_return>(T_params,) var = callable`
	- `<T_return>` : return 타입
	- `(T_params,)` : parameter 타입, 복수 가능
	- `var` : 생성 객체
	- `callable` : callable 객체, **주소값**

```cpp
#include <functional>
#include <iostream>
#include <string>

int some_func1(const std::string& a) {
  std::cout << "Func1 호출! " << a << std::endl;
  return 0;
}

struct S {
  void operator()(char c) { std::cout << "Func2 호출! " << c << std::endl; }
};

int main() {
  std::function<int(const std::string&)> f1 = some_func1;
  std::function<void(char)> f2 = S();	// ()는 operator로 정의됨
  std::function<void()> f3 = []() { std::cout << "Func3 호출! " << std::endl; };

  f1("hello");
  f2('c');
  f3();
}
```

## std::mem_fn
> 멤버 함수(또는 변수)의 경우 **인스턴스(instance)가 생성**되어야 실행이 가능하다.
> 따라서 보편적으로 정의하는 `std::function`을 생성하기 어렵다(this가 어떤 instance를 의미하는지 알 수 없기 때문).
> 따라서 객체의 **주소값**을 명시적으로 **전달**하거나 `std::mem_fn` 메소드를 사용한다.

- 일반적인 함수 : **함수의 이름** -> **함수의 주소값**으로 암시적 변환
- 멤버 함수 : <span style="color:rgb(255, 0, 0)">암시적 변환 발생 x</span>

```cpp
void fun(){};
void some_member_func(){}

// 주소값 변환
fun
&some_member_func
```

- `std::function<T_return>(obj&) var = &obj::callable` : 주소에 의한 전달

```cpp
class A {
  ...
 public:
  ...
  int some_func() {}
  int some_const_function() const {}
  ...
};

std::function<int(A&)> f1 = &A::some_func;
std::function<int(const A&)> f2 = &A::some_const_function;
```

- **std::function** 방식은 **컨테이너**에서 **멤버 함수를 불러**올 경우 **문제 발생**
	- 내부 접근을 멤버 접근자(`.`, `->`)를 사용해야 하기 때문

```cpp
#include <algorithm>
#include <functional>
#include <iostream>
#include <vector>
using std::vector;

int main() {
  vector<int> a(1);
  vector<int> b(2);
  vector<int> c(3);
  vector<int> d(4);

  vector<vector<int>> container;
  container.push_back(b);
  container.push_back(d);
  container.push_back(a);
  container.push_back(c);

  vector<int> size_vec(4);
  std::transform(container.begin(), container.end(), size_vec.begin(),
            &vector<int>::size);	// error
  for (auto itr = size_vec.begin(); itr != size_vec.end(); ++itr) {
    std::cout << "벡터 크기 :: " << *itr << std::endl;
  }
}
```

---

```cpp
template <class InputIt, class OutputIt, class UnaryOperation>
OutputIt transform(InputIt first1, InputIt last1, OutputIt d_first,
                   UnaryOperation unary_op) {
  while (first1 != last1) {
    *d_first++ = unary_op(*first1);
    first1++;
  }
  return d_first;
}
```

- `*d_first++ = unary_op(*first1);` 가 다음과 같이 작동
	- `&vector<int>::size(*first);`
- 실제로는 다음과 같이 작동해야 함
	- `(*first).(*&vector<int>::size)`
	- `first->(*&vector<int>::size)`
- `std::mem_fn` : `std::function` **객체를 return**하는 메소드
	- **lambda 함수**로 **대체가 가능**하여 자주 사용하지는 않음

```cpp
#include <algorithm>
#include <functional>
#include <iostream>
#include <vector>
using std::vector;

int main() {
  vector<int> a(1);
  vector<int> b(2);
  vector<int> c(3);
  vector<int> d(4);

  vector<vector<int>> container;
  container.push_back(a);
  container.push_back(b);
  container.push_back(c);
  container.push_back(d);

  vector<int> size_vec(4);
  transform(container.begin(), container.end(), size_vec.begin(),
            std::mem_fn(&vector<int>::size));	// std::mem_fn
  transform(container.begin(), container.end(), size_vec.begin(),
            [](const auto& v){ return v.size()});	// lambda
  for (auto itr = size_vec.begin(); itr != size_vec.end(); ++itr) {
    std::cout << "벡터 크기 :: " << *itr << std::endl;
  }
}

>>> 

벡터 크기 :: 1
벡터 크기 :: 2
벡터 크기 :: 3
벡터 크기 :: 4
```

## std::bind
> 변수 생성 시 `std::placeholders::_n`을 사용하여 인자의 생략하여 나중에 사용하는 **Closure** 를 생성한다.

- `T var = std::bind(callable, params, std::placeholders::_n)`
	- `callable` : callable 주소값
	- `params` : 인자(parameters)
	- `std::placeholders::_n` : **n번째 인자**를 의미하며, **naming parameter**(순서에 상관 없음)
	- `params`와 `std::placeholders::_n`의 개수는 **함수의 인자 개수**와 동일
- `var(n1, n2, ...)` 형태로 사용
		- n1, n2, ...는 placeholders를 의미하며, **초과**되는 개수는 **무시**

```cpp
#include <functional>
#include <iostream>

void add(int x, int y) {
  std::cout << x << " + " << y << " = " << x + y << std::endl;
}

void subtract(int x, int y) {
  std::cout << x << " - " << y << " = " << x - y << std::endl;
}
int main() {
  auto add_with_2 = std::bind(add, 2, std::placeholders::_1);
  add_with_2(3);

  // 두 번째 인자는 무시된다.
  add_with_2(3, 4);

  auto subtract_from_2 = std::bind(subtract, std::placeholders::_1, 2);
  auto negate =
      std::bind(subtract, std::placeholders::_2, std::placeholders::_1);

  subtract_from_2(3);  // 3 - 2 를 계산한다.
  negate(4, 2);        // 2 - 4 를 계산한다
}

>>> 

2 + 3 = 5
2 + 3 = 5
3 - 2 = 1
2 - 4 = -2
```

### reference인자와 std::ref
> `std::bind`로 생성된 객체는 인자를 복사 생성으로 전달한다.
> 따라서 reference에 의한 값의 변경이 이루어지지 않기 때문에
> `std::ref`를 통해 명시적으로 전달해야 한다.

- `std::ref` : 객체의 주소값 전달

```cpp
#include <functional>
#include <iostream>

struct S {
  int data;
  S(int data) : data(data) { std::cout << "일반 생성자 호출!" << std::endl; }
  S(const S& s) {
    std::cout << "복사 생성자 호출!" << std::endl;
    data = s.data;
  }

  S(S&& s) {
    std::cout << "이동 생성자 호출!" << std::endl;
    data = s.data;
  }
};

void do_something(S& s1, const S& s2) { s1.data = s2.data + 3; }

int main() {
  S s1(1), s2(2);

  std::cout << "Before : " << s1.data << std::endl;

  // s1 이 그대로 전달된 것이 아니라 s1 의 복사본이 전달됨!
  auto do_something_with_s1 =
      std::bind(do_something, s1, std::placeholders::_1);
  do_something_with_s1(s2);		// After :: 1, 값이 변하지 않음
	  std::bind(do_something, std::ref(s1), std::placeholders::_1);
  do_something_with_s1(s2);		// After :: 5, 값이 변함

  std::cout << "After :: " << s1.data << std::endl;
}

>>> 

일반 생성자 호출!
일반 생성자 호출!
Before : 1
After :: 5	// 인자를 std::ref를 받았을 경우
```